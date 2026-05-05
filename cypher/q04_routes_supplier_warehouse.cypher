// Q04 - Possible routes between a supplier and a warehouse, ordered by total cost.
// Params: $supplierId, $warehouseId
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
LIMIT 5;
