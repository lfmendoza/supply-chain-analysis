"""Disruption types and Cypher templates used by the simulation engine.

Each scenario type has two Cypher blocks:
  - APPLY: mutates properties (saving baseline copies first) and creates
    `(:DisruptionScenario)-[:IMPACTS]->(target)` relationships.
  - REVERT: restores baselines and removes the IMPACTS edges.

Saving baselines as `_baseline*` properties on the same nodes/relationships is
the simplest reversible strategy and avoids duplicating subgraphs.
"""

from __future__ import annotations

from enum import Enum


class DisruptionType(str, Enum):
    SUPPLIER_DOWN = "supplier_down"
    ROUTE_BLOCKED = "route_blocked"
    DEMAND_SPIKE = "demand_spike"
    INVENTORY_DROP = "inventory_drop"
    COST_INCREASE = "cost_increase"


# ---------------------------------------------------------------------------
# Apply blocks (Cypher)
# ---------------------------------------------------------------------------

APPLY_SUPPLIER_DOWN = """
MATCH (ds:DisruptionScenario {id: $scenarioId}), (s:Supplier {id: $supplierId})
SET s._baselineStatus = coalesce(s._baselineStatus, s.status),
    s.status = 'inactive'
MERGE (ds)-[i:IMPACTS]->(s)
SET i.severity = 3,
    i.simulatedAt = $simulatedAt,
    i.targetType = 'Supplier'
RETURN s.id AS supplierId
"""

APPLY_ROUTE_BLOCKED = """
MATCH (ds:DisruptionScenario {id: $scenarioId})
MATCH ()-[r:CONNECTED_TO {routeId: $routeId}]-()
SET r._baselineStatus = coalesce(r._baselineStatus, r.status),
    r.status = 'blocked'
WITH ds, collect(DISTINCT r.routeId)[0] AS rid
MATCH (rt:Route {id: rid})
MERGE (ds)-[i:IMPACTS]->(rt)
SET i.severity = 2,
    i.simulatedAt = $simulatedAt,
    i.targetType = 'Route'
RETURN rid AS routeId
"""

APPLY_DEMAND_SPIKE = """
MATCH (ds:DisruptionScenario {id: $scenarioId})
MATCH (co:CustomerOrder {status: 'pending'})-[fp:FOR_PRODUCT]->(p:Product {id: $productId})
SET co._baselineQuantity = coalesce(co._baselineQuantity, co.quantity),
    co.quantity = toInteger(co.quantity * $factor),
    fp._baselineQuantity = coalesce(fp._baselineQuantity, fp.quantity),
    fp.quantity = toInteger(fp.quantity * $factor)
MERGE (ds)-[i:IMPACTS]->(p)
SET i.severity = 1,
    i.simulatedAt = $simulatedAt,
    i.targetType = 'Product'
RETURN count(co) AS affectedOrders
"""

APPLY_INVENTORY_DROP = """
MATCH (ds:DisruptionScenario {id: $scenarioId})
OPTIONAL MATCH (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p:Product)
WHERE ($warehouseId IS NULL OR w.id = $warehouseId)
  AND ($productId   IS NULL OR p.id = $productId)
WITH ds, inv WHERE inv IS NOT NULL
SET inv._baselineQuantity = coalesce(inv._baselineQuantity, inv.quantity),
    inv.quantity = toInteger(inv.quantity * $factor)
MERGE (ds)-[i:IMPACTS]->(inv)
SET i.severity = 2,
    i.simulatedAt = $simulatedAt,
    i.targetType = 'Inventory'
RETURN count(inv) AS affectedInventory
"""

APPLY_COST_INCREASE = """
MATCH (ds:DisruptionScenario {id: $scenarioId})
MATCH ()-[r:CONNECTED_TO]-()
WHERE ($routeId IS NULL OR r.routeId = $routeId)
  AND ($mode    IS NULL OR EXISTS {
        MATCH (rt:Route {id: r.routeId})
        WHERE rt.mode = $mode
      })
WITH ds, r
SET r._baselineCost = coalesce(r._baselineCost, r.baseCost),
    r.baseCost = r.baseCost * $factor
WITH ds, collect(DISTINCT r.routeId) AS routeIds
UNWIND routeIds AS rid
MATCH (rt:Route {id: rid})
MERGE (ds)-[i:IMPACTS]->(rt)
SET i.severity = 1,
    i.simulatedAt = $simulatedAt,
    i.targetType = 'Route'
RETURN count(rid) AS affectedRoutes
"""

# ---------------------------------------------------------------------------
# Revert blocks (scenario-scoped)
#
# Each REVERT_* block walks the IMPACTS edges of the supplied scenario id and
# only restores baselines on entities tied to that scenario. This prevents a
# revert from clobbering a different active scenario's mutations.
# ---------------------------------------------------------------------------

REVERT_SUPPLIERS_SCOPED = """
MATCH (ds:DisruptionScenario {id: $scenarioId})-[:IMPACTS]->(s:Supplier)
WHERE s._baselineStatus IS NOT NULL
SET s.status = s._baselineStatus
REMOVE s._baselineStatus
"""

REVERT_ROUTES_STATUS_SCOPED = """
MATCH (ds:DisruptionScenario {id: $scenarioId})-[i:IMPACTS]->(rt:Route)
WITH DISTINCT rt
MATCH ()-[r:CONNECTED_TO {routeId: rt.id}]-()
WHERE r._baselineStatus IS NOT NULL
SET r.status = r._baselineStatus
REMOVE r._baselineStatus
"""

REVERT_ROUTES_COST_SCOPED = """
MATCH (ds:DisruptionScenario {id: $scenarioId})-[i:IMPACTS]->(rt:Route)
WITH DISTINCT rt
MATCH ()-[r:CONNECTED_TO {routeId: rt.id}]-()
WHERE r._baselineCost IS NOT NULL
SET r.baseCost = r._baselineCost
REMOVE r._baselineCost
"""

REVERT_INVENTORY_SCOPED = """
MATCH (ds:DisruptionScenario {id: $scenarioId})-[:IMPACTS]->(inv:Inventory)
WHERE inv._baselineQuantity IS NOT NULL
SET inv.quantity = inv._baselineQuantity
REMOVE inv._baselineQuantity
"""

REVERT_ORDERS_SCOPED = """
MATCH (ds:DisruptionScenario {id: $scenarioId})-[:IMPACTS]->(p:Product)
MATCH (co:CustomerOrder)-[fp:FOR_PRODUCT]->(p)
WHERE co._baselineQuantity IS NOT NULL OR fp._baselineQuantity IS NOT NULL
WITH co, fp
FOREACH (_ IN CASE WHEN co._baselineQuantity IS NOT NULL THEN [1] ELSE [] END |
    SET co.quantity = co._baselineQuantity
    REMOVE co._baselineQuantity)
FOREACH (_ IN CASE WHEN fp._baselineQuantity IS NOT NULL THEN [1] ELSE [] END |
    SET fp.quantity = fp._baselineQuantity
    REMOVE fp._baselineQuantity)
"""

REVERT_DETACH_SCENARIO = """
MATCH (ds:DisruptionScenario {id: $scenarioId})
DETACH DELETE ds
"""

CREATE_SCENARIO = """
MERGE (ds:DisruptionScenario {id: $id})
SET ds.type = $type,
    ds.description = $description,
    ds.params = $params,
    ds.createdAt = $createdAt,
    ds.status = 'active'
RETURN ds.id AS id
"""

LIST_SCENARIOS = """
MATCH (ds:DisruptionScenario)
OPTIONAL MATCH (ds)-[i:IMPACTS]->(t)
RETURN ds.id AS id,
       ds.type AS type,
       ds.description AS description,
       ds.status AS status,
       ds.createdAt AS createdAt,
       count(i) AS impactsCount
ORDER BY ds.createdAt DESC
"""

GET_SCENARIO_IMPACTS = """
MATCH (ds:DisruptionScenario {id: $scenarioId})-[i:IMPACTS]->(t)
RETURN i.targetType AS targetType,
       coalesce(t.id, '') AS targetId,
       coalesce(t.name, '') AS targetName,
       i.severity AS severity,
       i.simulatedAt AS simulatedAt
"""
