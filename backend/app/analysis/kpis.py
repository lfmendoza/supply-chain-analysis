"""KPI computation and the comparison endpoint.

Comparison surfaces three states:
  - base       : the graph as it would behave with no scenario (we re-derive
                 it from the *_baseline copies stored on the affected nodes).
  - disrupted  : the graph with the scenario applied but no optimization
                 result. We compute fulfilment by greedy "best-cost feasible"
                 walking through pending orders.
  - optimized  : the latest OptimizedAssignment for that scenario.

All KPIs are derived from the same Cypher snapshots so the same code path
applies to every state by switching parameters.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.db.neo4j_client import Neo4jClientError, get_neo4j_client

router = APIRouter(tags=["analysis"])


# ---------------------------------------------------------------------------
# Cypher
# ---------------------------------------------------------------------------

GET_PENDING_ORDERS = """
MATCH (co:CustomerOrder {status: 'pending'})-[fp:FOR_PRODUCT]->(p:Product),
      (co)-[:PLACED_BY]->(c:Customer)-[:LOCATED_AT]->(loc:Location)
RETURN co.id AS orderId,
       p.id AS productId,
       fp.quantity AS quantity,
       co.priority AS priority,
       coalesce(co.revenue, 0) AS revenue,
       loc.id AS customerLocationId
"""

GET_INVENTORY = """
MATCH (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p:Product)
RETURN w.id AS warehouseId, p.id AS productId, inv.quantity AS quantity
"""

GET_BASELINE_INVENTORY = """
MATCH (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p:Product)
RETURN w.id AS warehouseId,
       p.id AS productId,
       coalesce(inv._baselineQuantity, inv.quantity) AS quantity
"""

GET_BASELINE_PENDING = """
MATCH (co:CustomerOrder)-[fp:FOR_PRODUCT]->(p:Product),
      (co)-[:PLACED_BY]->(c:Customer)-[:LOCATED_AT]->(loc:Location)
WHERE coalesce(co._baselineStatus, co.status) = 'pending'
RETURN co.id AS orderId,
       p.id AS productId,
       coalesce(fp._baselineQuantity, fp.quantity) AS quantity,
       co.priority AS priority,
       coalesce(co.revenue, 0) AS revenue,
       loc.id AS customerLocationId
"""

GET_WAREHOUSES = """
MATCH (w:Warehouse)-[:LOCATED_AT]->(loc:Location)
RETURN w.id AS warehouseId, loc.id AS locationId, w.dispatchCapacityPerWeek AS capacity
"""

SHORTEST_PATH = """
MATCH (a:Location {id: $fromLocId}), (b:Location {id: $toLocId})
MATCH path = (a)-[:CONNECTED_TO*1..6]-(b)
WHERE all(r IN relationships(path) WHERE r.status = 'open')
WITH path,
     reduce(c=0.0, r IN relationships(path) | c + r.baseCost) AS cost,
     reduce(t=0,   r IN relationships(path) | t + r.leadTimeDays) AS leadTime
ORDER BY cost ASC
LIMIT 1
RETURN cost, leadTime
"""

# Same as above but using baseline cost and ignoring blocked status (i.e. the
# "before-disruption" view).
SHORTEST_PATH_BASELINE = """
MATCH (a:Location {id: $fromLocId}), (b:Location {id: $toLocId})
MATCH path = (a)-[:CONNECTED_TO*1..6]-(b)
WHERE all(r IN relationships(path) WHERE coalesce(r._baselineStatus, r.status) = 'open')
WITH path,
     reduce(c=0.0, r IN relationships(path) | c + coalesce(r._baselineCost, r.baseCost)) AS cost,
     reduce(t=0,   r IN relationships(path) | t + r.leadTimeDays) AS leadTime
ORDER BY cost ASC
LIMIT 1
RETURN cost, leadTime
"""

GET_OPTIMIZED_ASSIGNMENT = """
MATCH (oa:OptimizedAssignment {scenarioId: $scenarioId})-[r:RECOMMENDED]->(co:CustomerOrder)
RETURN oa.id AS assignmentId,
       oa.objectiveValue AS objectiveValue,
       co.id AS orderId,
       r.warehouseId AS warehouseId,
       r.cost AS cost,
       r.leadTime AS leadTime,
       r.risk AS risk
"""

GET_OPTIMIZED_UNFULFILLED = """
MATCH (oa:OptimizedAssignment {scenarioId: $scenarioId})
WITH oa
MATCH (co:CustomerOrder {status: 'pending'})
WHERE NOT EXISTS { (oa)-[:RECOMMENDED]->(co) }
RETURN co.id AS orderId, coalesce(co.revenue, 0) AS revenue
"""

WAREHOUSE_USAGE = """
MATCH (oa:OptimizedAssignment {scenarioId: $scenarioId})-[r:RECOMMENDED]->(co:CustomerOrder)-[fp:FOR_PRODUCT]->(:Product)
WITH r.warehouseId AS warehouseId, sum(fp.quantity) AS used
MATCH (w:Warehouse {id: warehouseId})
RETURN warehouseId, used, w.dispatchCapacityPerWeek AS capacity
"""


# ---------------------------------------------------------------------------
# Greedy fulfilment for "base" and "disrupted" states
# ---------------------------------------------------------------------------

@dataclass
class StateMetrics:
    state: str
    totalCost: float
    avgLeadTime: float
    fulfillmentPct: float
    ordersAffected: int
    revenueAtRisk: float
    riskWeighted: float
    avgRisk: float
    assignedOrders: int
    totalOrders: int
    warehouseUsage: dict[str, dict[str, Any]]


def _greedy_fulfil(orders: list[dict], warehouses: list[dict], inventory: dict, path_query: str) -> StateMetrics:
    cli = get_neo4j_client()
    inv_local = dict(inventory)
    capacity_left = {w["warehouseId"]: int(w["capacity"] or 10_000) for w in warehouses}
    path_cache: dict[tuple[str, str], dict | None] = {}

    total_cost = 0.0
    lead_sum = 0
    risk_sum = 0.0  # placeholder: we do not reuse the optimizer's risk here; greedy uses 0.5 default
    assigned = 0
    revenue_at_risk = 0.0
    affected: list[dict] = []
    usage: dict[str, dict[str, Any]] = {w["warehouseId"]: {"used": 0, "capacity": int(w["capacity"] or 10_000)} for w in warehouses}

    # Iterate orders by priority then revenue desc.
    for o in sorted(orders, key=lambda o: (int(o["priority"]), -float(o["revenue"]))):
        best = None
        for w in warehouses:
            stock = inv_local.get((w["warehouseId"], o["productId"]), 0)
            if stock < o["quantity"]:
                continue
            if capacity_left[w["warehouseId"]] < o["quantity"]:
                continue
            key = (w["locationId"], o["customerLocationId"])
            if key not in path_cache:
                rows = cli.run(path_query, {"fromLocId": key[0], "toLocId": key[1]})
                path_cache[key] = rows[0] if rows else None
            path = path_cache[key]
            if path is None:
                continue
            cand = (float(path["cost"]), int(path["leadTime"]), w)
            if best is None or cand[0] < best[0]:
                best = cand
        if best is None:
            affected.append(o)
            revenue_at_risk += float(o["revenue"])
            continue
        cost, lt, w = best
        inv_local[(w["warehouseId"], o["productId"])] -= o["quantity"]
        capacity_left[w["warehouseId"]] -= o["quantity"]
        usage[w["warehouseId"]]["used"] += o["quantity"]
        total_cost += cost
        lead_sum += lt
        risk_sum += 0.5  # default risk for greedy state
        assigned += 1

    total = len(orders)
    return StateMetrics(
        state="",
        totalCost=round(total_cost, 2),
        avgLeadTime=round(lead_sum / assigned, 2) if assigned else 0.0,
        fulfillmentPct=round(100.0 * assigned / total, 2) if total else 0.0,
        ordersAffected=len(affected),
        revenueAtRisk=round(revenue_at_risk, 2),
        riskWeighted=round(risk_sum, 2),
        avgRisk=round(risk_sum / assigned, 4) if assigned else 0.0,
        assignedOrders=assigned,
        totalOrders=total,
        warehouseUsage=usage,
    )


def _optimized_metrics(scenario_id: str) -> StateMetrics:
    cli = get_neo4j_client()
    rows = cli.run(GET_OPTIMIZED_ASSIGNMENT, {"scenarioId": scenario_id})
    if not rows:
        return StateMetrics(
            state="optimized",
            totalCost=0.0,
            avgLeadTime=0.0,
            fulfillmentPct=0.0,
            ordersAffected=0,
            revenueAtRisk=0.0,
            riskWeighted=0.0,
            avgRisk=0.0,
            assignedOrders=0,
            totalOrders=0,
            warehouseUsage={},
        )

    cost_sum = sum(float(r["cost"] or 0) for r in rows)
    lt_sum = sum(int(r["leadTime"] or 0) for r in rows)
    risk_sum = sum(float(r["risk"] or 0) for r in rows)
    assigned = len(rows)

    pending_total = cli.run("MATCH (co:CustomerOrder {status: 'pending'}) RETURN count(co) AS c")[0]["c"]
    unful_rows = cli.run(GET_OPTIMIZED_UNFULFILLED, {"scenarioId": scenario_id})
    revenue_at_risk = sum(float(r["revenue"] or 0) for r in unful_rows)

    usage_rows = cli.run(WAREHOUSE_USAGE, {"scenarioId": scenario_id})
    usage = {
        r["warehouseId"]: {"used": int(r["used"] or 0), "capacity": int(r["capacity"] or 0)}
        for r in usage_rows
    }

    total = pending_total
    return StateMetrics(
        state="optimized",
        totalCost=round(cost_sum, 2),
        avgLeadTime=round(lt_sum / assigned, 2) if assigned else 0.0,
        fulfillmentPct=round(100.0 * assigned / total, 2) if total else 0.0,
        ordersAffected=len(unful_rows),
        revenueAtRisk=round(revenue_at_risk, 2),
        riskWeighted=round(risk_sum, 4),
        avgRisk=round(risk_sum / assigned, 4) if assigned else 0.0,
        assignedOrders=assigned,
        totalOrders=total,
        warehouseUsage=usage,
    )


def _build_inventory(rows: list[dict]) -> dict:
    return {(r["warehouseId"], r["productId"]): int(r["quantity"] or 0) for r in rows}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/scenarios/{scenario_id}/comparison", summary="Compare base / disrupted / optimized states")
def comparison(scenario_id: str) -> dict:
    cli = get_neo4j_client()
    try:
        warehouses = cli.run(GET_WAREHOUSES)

        # Disrupted state uses live properties.
        disrupted_orders = cli.run(GET_PENDING_ORDERS)
        disrupted_inv = _build_inventory(cli.run(GET_INVENTORY))
        disrupted = _greedy_fulfil(disrupted_orders, warehouses, disrupted_inv, SHORTEST_PATH)
        disrupted.state = "disrupted"

        # Base state uses baselines (if present), otherwise current.
        base_orders = cli.run(GET_BASELINE_PENDING)
        base_inv = _build_inventory(cli.run(GET_BASELINE_INVENTORY))
        base = _greedy_fulfil(base_orders, warehouses, base_inv, SHORTEST_PATH_BASELINE)
        base.state = "base"

        optimized = _optimized_metrics(scenario_id)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    deltas = {
        "costRecovered": round(disrupted.totalCost - optimized.totalCost, 2) if optimized.assignedOrders else 0.0,
        "ordersRecovered": disrupted.ordersAffected - optimized.ordersAffected if optimized.assignedOrders else 0,
        "fulfillmentImprovement": round(optimized.fulfillmentPct - disrupted.fulfillmentPct, 2) if optimized.assignedOrders else 0.0,
        "leadTimeImprovement": round(disrupted.avgLeadTime - optimized.avgLeadTime, 2) if optimized.assignedOrders else 0.0,
        "revenueRecovered": round(disrupted.revenueAtRisk - optimized.revenueAtRisk, 2) if optimized.assignedOrders else 0.0,
    }

    return {
        "scenarioId": scenario_id,
        "base": base.__dict__,
        "disrupted": disrupted.__dict__,
        "optimized": optimized.__dict__,
        "deltas": deltas,
    }
