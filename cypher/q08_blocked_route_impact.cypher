// Q08 - Read-only impact analysis of blocking a given route id.
// Returns suppliers that become isolated from each warehouse if route $routeId
// is blocked. Uses a pattern predicate that excludes the candidate route.
// Param: $routeId
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
       w.name AS warehouseName;
