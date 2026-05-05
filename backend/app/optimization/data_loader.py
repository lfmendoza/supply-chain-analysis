"""Extract the optimization input from Neo4j into in-memory dataclasses.

Strategy:
  * Pull pending orders, active warehouses, and inventory in three queries.
  * Compute (warehouse, customer) shipping cost / lead time / risk via a
    Cypher shortest path, weighted by `baseCost`. If GDS is unavailable on
    the AuraDB Free instance we fall back to the variable-length pattern
    used in the demo queries.
  * Aggregate everything into typed structures the solver can iterate over.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.db.neo4j_client import Neo4jClient, get_neo4j_client


# ---------------------------------------------------------------------------
# Cypher templates
# ---------------------------------------------------------------------------

PENDING_ORDERS = """
MATCH (co:CustomerOrder {status: 'pending'})-[fp:FOR_PRODUCT]->(p:Product),
      (co)-[:PLACED_BY]->(c:Customer)-[:LOCATED_AT]->(loc:Location)
RETURN co.id AS orderId,
       p.id AS productId,
       fp.quantity AS quantity,
       co.priority AS priority,
       co.revenue AS revenue,
       co.dueDate AS dueDate,
       c.id AS customerId,
       loc.id AS customerLocationId
"""

ACTIVE_WAREHOUSES = """
MATCH (w:Warehouse)-[:LOCATED_AT]->(loc:Location)
RETURN w.id AS warehouseId,
       w.name AS warehouseName,
       w.region AS region,
       w.dispatchCapacityPerWeek AS capacity,
       loc.id AS locationId
"""

INVENTORY_BY_WP = """
MATCH (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p:Product)
RETURN w.id AS warehouseId,
       p.id AS productId,
       inv.quantity AS quantity,
       inv.safetyStock AS safetyStock
"""

# Shortest path (weighted by baseCost) between two locations, plus aggregated
# leadTime and a coarse risk proxy (sum of (1 - reliabilityScore) per leg).
SHORTEST_PATH_BETWEEN = """
MATCH (a:Location {id: $fromLocId}), (b:Location {id: $toLocId})
MATCH path = (a)-[:CONNECTED_TO*1..6]-(b)
WHERE all(r IN relationships(path) WHERE r.status = 'open')
WITH path,
     reduce(c=0.0, r IN relationships(path) | c + r.baseCost) AS cost,
     reduce(t=0,   r IN relationships(path) | t + r.leadTimeDays) AS leadTime,
     [r IN relationships(path) | r.routeId] AS routeIds
ORDER BY cost ASC
LIMIT 1
RETURN cost, leadTime, routeIds
"""

CARRIER_RELIABILITY = """
MATCH (rt:Route)-[:CARRIED_BY]->(c:Carrier)
RETURN rt.id AS routeId, c.reliabilityScore AS reliability
"""

SUPPLIER_RISK_BY_PRODUCT = """
MATCH (s:Supplier {status: 'active'})-[:SUPPLIES]->(rm:RawMaterial)-[:USED_IN]->(p:Product {id: $productId})
RETURN avg(s.riskScore) AS avgSupplierRisk
"""


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class OrderInput:
    order_id: str
    product_id: str
    quantity: int
    priority: int
    revenue: float
    customer_id: str
    customer_location_id: str


@dataclass(frozen=True)
class WarehouseInput:
    warehouse_id: str
    name: str
    region: str
    capacity: int
    location_id: str


@dataclass
class OptimizationData:
    orders: list[OrderInput]
    warehouses: list[WarehouseInput]
    inventory: dict[tuple[str, str], int]            # (warehouse_id, product_id) -> qty
    cost: dict[tuple[str, str], float]               # (warehouse_id, order_id) -> shipping cost
    lead_time: dict[tuple[str, str], int]            # (warehouse_id, order_id) -> total leadTime
    risk: dict[tuple[str, str], float]               # (warehouse_id, order_id) -> aggregate risk
    feasible: dict[tuple[str, str], bool] = field(default_factory=dict)
    supplier_risk_by_product: dict[str, float] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

class DataLoader:
    def __init__(self, client: Neo4jClient | None = None) -> None:
        self._client = client or get_neo4j_client()

    def load(self) -> OptimizationData:
        orders_rows = self._client.run(PENDING_ORDERS)
        warehouses_rows = self._client.run(ACTIVE_WAREHOUSES)
        inventory_rows = self._client.run(INVENTORY_BY_WP)

        orders = [
            OrderInput(
                order_id=row["orderId"],
                product_id=row["productId"],
                quantity=int(row["quantity"]),
                priority=int(row["priority"]),
                revenue=float(row["revenue"] or 0),
                customer_id=row["customerId"],
                customer_location_id=row["customerLocationId"],
            )
            for row in orders_rows
        ]

        warehouses = [
            WarehouseInput(
                warehouse_id=row["warehouseId"],
                name=row["warehouseName"],
                region=row["region"] or "",
                capacity=int(row["capacity"] or 10_000),
                location_id=row["locationId"],
            )
            for row in warehouses_rows
        ]

        inventory: dict[tuple[str, str], int] = {}
        for row in inventory_rows:
            inventory[(row["warehouseId"], row["productId"])] = int(row["quantity"] or 0)

        # Pre-compute supplier risk averaged per product (used when no carrier
        # info is available).
        risk_by_product: dict[str, float] = {}
        for o in orders:
            if o.product_id in risk_by_product:
                continue
            r = self._client.run(SUPPLIER_RISK_BY_PRODUCT, {"productId": o.product_id})
            risk_by_product[o.product_id] = float((r[0]["avgSupplierRisk"] if r else 0) or 0.5)

        # Carrier reliability map -> average risk for a path = mean(1 - reliability).
        reliability_rows = self._client.run(CARRIER_RELIABILITY)
        carrier_risk_by_route = {row["routeId"]: 1.0 - float(row["reliability"] or 0.5) for row in reliability_rows}

        # Compute cost/leadTime/risk for every (warehouse, order) pair.
        # We cache shortest paths between pairs of locations because many
        # orders share the same customer location.
        path_cache: dict[tuple[str, str], dict[str, Any] | None] = {}
        cost: dict[tuple[str, str], float] = {}
        lead_time: dict[tuple[str, str], int] = {}
        risk: dict[tuple[str, str], float] = {}
        feasible: dict[tuple[str, str], bool] = {}

        for w in warehouses:
            for o in orders:
                key_loc = (w.location_id, o.customer_location_id)
                if key_loc not in path_cache:
                    rows = self._client.run(
                        SHORTEST_PATH_BETWEEN,
                        {"fromLocId": w.location_id, "toLocId": o.customer_location_id},
                    )
                    path_cache[key_loc] = rows[0] if rows else None
                path = path_cache[key_loc]

                key_wo = (w.warehouse_id, o.order_id)
                if path is None:
                    cost[key_wo] = float("inf")
                    lead_time[key_wo] = 10_000
                    risk[key_wo] = 1.0
                    feasible[key_wo] = False
                    continue

                route_ids = path["routeIds"] or []
                if route_ids:
                    avg_carrier_risk = sum(carrier_risk_by_route.get(rid, 0.5) for rid in route_ids) / len(route_ids)
                else:
                    avg_carrier_risk = 0.5
                supplier_risk = risk_by_product.get(o.product_id, 0.5)
                # Combine carrier and supplier risk equally.
                aggregate_risk = round(0.5 * avg_carrier_risk + 0.5 * supplier_risk, 4)

                cost[key_wo] = float(path["cost"])
                lead_time[key_wo] = int(path["leadTime"])
                risk[key_wo] = aggregate_risk
                feasible[key_wo] = inventory.get((w.warehouse_id, o.product_id), 0) >= o.quantity

        return OptimizationData(
            orders=orders,
            warehouses=warehouses,
            inventory=inventory,
            cost=cost,
            lead_time=lead_time,
            risk=risk,
            feasible=feasible,
            supplier_risk_by_product=risk_by_product,
        )
