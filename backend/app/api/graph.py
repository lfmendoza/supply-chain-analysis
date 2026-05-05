"""Graph and analysis endpoints (Phase 4).

These endpoints are thin wrappers over the Cypher templates in
`app.db.queries.graph_queries`. They power the topology view, traceability,
impact analysis, alternative supplier lookup and unfulfillable orders.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.neo4j_client import Neo4jClientError, get_neo4j_client
from app.db.queries import graph_queries as Q

router = APIRouter(tags=["graph"])


def _run(cypher: str, params: dict | None = None) -> list[dict]:
    try:
        return get_neo4j_client().run(cypher, params or {})
    except Neo4jClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


# ---------------------------------------------------------------------------
# Summary / topology
# ---------------------------------------------------------------------------

@router.get("/graph/summary")
def graph_summary() -> dict:
    counts = _run(Q.GRAPH_SUMMARY_NODES)
    nodes = _run(Q.TOPOLOGY_NODES)
    edges = _run(Q.TOPOLOGY_EDGES)
    return {
        "counts": {row["label"]: row["c"] for row in counts},
        "nodes": nodes,
        "edges": edges,
    }


# ---------------------------------------------------------------------------
# Single-resource queries
# ---------------------------------------------------------------------------

@router.get("/products/{product_id}/traceability", summary="Q01 - Product traceability")
def product_traceability(product_id: str) -> list[dict]:
    return _run(Q.TRACEABILITY, {"productId": product_id})


@router.get("/suppliers/{supplier_id}/impact", summary="Q02 - Supplier impact")
def supplier_impact(supplier_id: str) -> list[dict]:
    return _run(Q.SUPPLIER_IMPACT, {"supplierId": supplier_id})


@router.get("/orders/no-inventory", summary="Q03 - Pending orders without feasible warehouse")
def orders_without_inventory() -> list[dict]:
    return _run(Q.ORDERS_NO_INVENTORY)


@router.get(
    "/routes/{supplier_id}/{warehouse_id}",
    summary="Q04 - Possible routes between supplier and warehouse",
)
def routes_between(supplier_id: str, warehouse_id: str) -> list[dict]:
    return _run(
        Q.ROUTES_SUPPLIER_WAREHOUSE,
        {"supplierId": supplier_id, "warehouseId": warehouse_id},
    )


@router.get("/materials/{raw_material_id}/alternatives", summary="Q05 - Alternative suppliers")
def alternative_suppliers(raw_material_id: str) -> list[dict]:
    return _run(Q.ALTERNATIVE_SUPPLIERS, {"rawMaterialId": raw_material_id})


@router.get(
    "/orders/{order_id}/feasible-warehouses",
    summary="Q06 - Warehouses with enough inventory for the order",
)
def warehouses_with_inventory(order_id: str) -> list[dict]:
    return _run(Q.WAREHOUSES_WITH_INVENTORY, {"orderId": order_id})


@router.get(
    "/analysis/critical-dependencies",
    summary="Q07 - Single-source raw materials and at-risk products",
)
def critical_dependencies() -> list[dict]:
    return _run(Q.CRITICAL_DEPENDENCIES)


@router.get(
    "/analysis/blocked-route-impact/{route_id}",
    summary="Q08 - Suppliers/warehouses that become disconnected if a route is blocked",
)
def blocked_route_impact(route_id: str) -> list[dict]:
    return _run(Q.BLOCKED_ROUTE_IMPACT, {"routeId": route_id})


@router.get(
    "/orders/unfulfillable",
    summary="Q09 - Aggregate count of unfulfillable orders and revenue at risk",
)
def unfulfillable_orders() -> dict:
    rows = _run(Q.UNFULFILLABLE_ORDERS)
    return rows[0] if rows else {"unfulfilled": 0, "revenueAtRisk": 0, "sampleOrderIds": []}


@router.get(
    "/materials/{raw_material_id}/full-chain",
    summary="Q10 - Full chain from a raw material to end customers",
)
def full_chain(raw_material_id: str) -> list[dict]:
    return _run(Q.FULL_CHAIN, {"rawMaterialId": raw_material_id})
