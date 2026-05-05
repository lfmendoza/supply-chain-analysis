"""Cypher templates used by the graph and analysis endpoints.

Each constant mirrors a file under `cypher/` so the demo can run the same
queries from Neo4j Browser. We keep them as Python strings here to avoid
file IO at request time.
"""

from __future__ import annotations

# Q01
TRACEABILITY = """
MATCH path = (s:Supplier)-[:SUPPLIES]->(rm:RawMaterial)-[:USED_IN]->(p:Product {id: $productId})
RETURN s.id  AS supplierId,
       s.name AS supplierName,
       rm.id AS rawMaterialId,
       rm.name AS rawMaterialName,
       p.id AS productId,
       p.name AS productName
"""

# Q02
SUPPLIER_IMPACT = """
MATCH (s:Supplier {id: $supplierId})-[:SUPPLIES]->(rm:RawMaterial)-[:USED_IN]->(p:Product)
OPTIONAL MATCH (alt:Supplier)-[:SUPPLIES]->(rm)
WHERE alt.id <> s.id AND alt.status = 'active'
WITH p, rm, count(alt) AS alternatives
RETURN p.id AS productId,
       p.name AS productName,
       rm.id AS rawMaterialId,
       rm.name AS rawMaterialName,
       alternatives,
       CASE WHEN alternatives = 0 THEN 'CRITICAL' ELSE 'AT_RISK' END AS impact
ORDER BY impact, productId
"""

# Q03
ORDERS_NO_INVENTORY = """
MATCH (co:CustomerOrder {status: 'pending'})-[fp:FOR_PRODUCT]->(p:Product)
OPTIONAL MATCH (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p)
WHERE inv.quantity >= fp.quantity
WITH co, p, collect(w.id) AS feasibleWarehouses
WHERE size(feasibleWarehouses) = 0
RETURN co.id AS orderId,
       p.id AS productId,
       p.name AS productName,
       co.priority AS priority,
       co.dueDate AS dueDate,
       co.revenue AS revenue
ORDER BY priority ASC, revenue DESC
"""

# Q04
ROUTES_SUPPLIER_WAREHOUSE = """
MATCH (s:Supplier {id: $supplierId})-[:LOCATED_AT]->(origin:Location),
      (w:Warehouse {id: $warehouseId})-[:LOCATED_AT]->(dest:Location)
MATCH path = (origin)-[:CONNECTED_TO*1..4]-(dest)
WHERE all(r IN relationships(path) WHERE r.status = 'open')
WITH path,
     reduce(c=0.0, r IN relationships(path) | c + r.baseCost) AS totalCost,
     reduce(t=0,   r IN relationships(path) | t + r.leadTimeDays) AS totalLeadTime,
     [n IN nodes(path) | n.id] AS hopIds
RETURN hopIds, totalCost, totalLeadTime
ORDER BY totalCost ASC
LIMIT 5
"""

# Q05
ALTERNATIVE_SUPPLIERS = """
MATCH (rm:RawMaterial {id: $rawMaterialId})<-[su:SUPPLIES]-(s:Supplier {status: 'active'})
RETURN s.id AS supplierId,
       s.name AS supplierName,
       su.unitCost AS unitCost,
       su.leadTimeDays AS leadTimeDays,
       s.riskScore AS riskScore,
       (su.unitCost + s.riskScore * 100) AS rankingScore
ORDER BY rankingScore ASC
"""

# Q06
WAREHOUSES_WITH_INVENTORY = """
MATCH (co:CustomerOrder {id: $orderId})-[fp:FOR_PRODUCT]->(p:Product),
      (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p)
WHERE inv.quantity >= fp.quantity
RETURN w.id AS warehouseId,
       w.name AS warehouseName,
       inv.quantity AS available,
       fp.quantity AS required,
       w.region AS region
ORDER BY available DESC
"""

# Q07
CRITICAL_DEPENDENCIES = """
MATCH (rm:RawMaterial)<-[:SUPPLIES]-(s:Supplier {status: 'active'})
WITH rm, count(s) AS activeSuppliers
WHERE activeSuppliers = 1
MATCH (rm)-[:USED_IN]->(p:Product)
WITH rm, activeSuppliers, collect(DISTINCT p.id) AS atRiskProductIds
RETURN rm.id AS rawMaterialId,
       rm.name AS rawMaterialName,
       activeSuppliers,
       atRiskProductIds
ORDER BY size(atRiskProductIds) DESC
"""

# Q08
BLOCKED_ROUTE_IMPACT = """
MATCH (s:Supplier)-[:LOCATED_AT]->(origin:Location),
      (w:Warehouse)-[:LOCATED_AT]->(dest:Location)
WHERE NOT EXISTS {
    MATCH path = (origin)-[:CONNECTED_TO*1..5]-(dest)
    WHERE all(rel IN relationships(path)
              WHERE rel.status = 'open' AND rel.routeId <> $routeId)
}
RETURN s.id AS supplierId,
       s.name AS supplierName,
       w.id AS warehouseId,
       w.name AS warehouseName
"""

# Q09
UNFULFILLABLE_ORDERS = """
MATCH (co:CustomerOrder {status: 'pending'})-[fp:FOR_PRODUCT]->(p:Product)
WHERE NOT EXISTS {
    MATCH (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p)
    WHERE inv.quantity >= fp.quantity
}
RETURN count(co) AS unfulfilled,
       sum(co.revenue) AS revenueAtRisk,
       collect(co.id)[..20] AS sampleOrderIds
"""

# Q10
FULL_CHAIN = """
MATCH (rm:RawMaterial {id: $rawMaterialId})-[:USED_IN]->(p:Product)<-[:FOR_PRODUCT]-(co:CustomerOrder)-[:PLACED_BY]->(c:Customer)
RETURN rm.id AS rawMaterialId,
       p.id AS productId,
       p.name AS productName,
       co.id AS orderId,
       c.id AS customerId,
       c.name AS customerName,
       co.priority AS priority,
       co.revenue AS revenue
ORDER BY priority ASC, revenue DESC
LIMIT 50
"""

# Aggregate summary used by the topology view.
GRAPH_SUMMARY_NODES = """
CALL {
    MATCH (n:Supplier)     RETURN 'Supplier'     AS label, count(n) AS c
    UNION ALL MATCH (n:RawMaterial)  RETURN 'RawMaterial'  AS label, count(n) AS c
    UNION ALL MATCH (n:Product)      RETURN 'Product'      AS label, count(n) AS c
    UNION ALL MATCH (n:Warehouse)    RETURN 'Warehouse'    AS label, count(n) AS c
    UNION ALL MATCH (n:Inventory)    RETURN 'Inventory'    AS label, count(n) AS c
    UNION ALL MATCH (n:Customer)     RETURN 'Customer'     AS label, count(n) AS c
    UNION ALL MATCH (n:CustomerOrder)RETURN 'CustomerOrder' AS label, count(n) AS c
    UNION ALL MATCH (n:PurchaseOrder)RETURN 'PurchaseOrder' AS label, count(n) AS c
    UNION ALL MATCH (n:Shipment)     RETURN 'Shipment'     AS label, count(n) AS c
    UNION ALL MATCH (n:Carrier)      RETURN 'Carrier'      AS label, count(n) AS c
    UNION ALL MATCH (n:Location)     RETURN 'Location'     AS label, count(n) AS c
    UNION ALL MATCH (n:Route)        RETURN 'Route'        AS label, count(n) AS c
    UNION ALL MATCH (n:DisruptionScenario) RETURN 'DisruptionScenario' AS label, count(n) AS c
    UNION ALL MATCH (n:OptimizedAssignment) RETURN 'OptimizedAssignment' AS label, count(n) AS c
}
RETURN label, c
"""

# Topology nodes for the dashboard. We fetch a manageable subset suitable for
# react-force-graph (Suppliers, RawMaterials, Products, Warehouses, Customers,
# Locations, Routes through CONNECTED_TO).
TOPOLOGY_NODES = """
MATCH (n)
WHERE n:Supplier OR n:RawMaterial OR n:Product OR n:Warehouse
   OR n:Customer OR n:Location OR n:Route OR n:Carrier
RETURN n.id AS id,
       labels(n)[0] AS label,
       coalesce(n.name, n.id) AS name,
       coalesce(n.status, 'active') AS status,
       coalesce(n.riskScore, null) AS riskScore
"""

TOPOLOGY_EDGES = """
MATCH (a)-[r]->(b)
WHERE type(r) IN ['SUPPLIES','USED_IN','LOCATED_AT','HAS_INVENTORY','OF_PRODUCT',
                  'CONNECTED_TO','CARRIED_BY','PLACED_BY','FOR_PRODUCT',
                  'SOURCED_FROM','FOR_MATERIAL','ALTERNATIVE_TO','DEPENDS_ON',
                  'ASSIGNED_TO']
RETURN a.id AS source,
       b.id AS target,
       type(r) AS relType,
       coalesce(r.status, null) AS status,
       coalesce(r.baseCost, null) AS cost
"""
