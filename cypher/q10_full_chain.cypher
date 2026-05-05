// Q10 - Full chain: from a raw material to the customers it ultimately serves.
// Param: $rawMaterialId
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
LIMIT 50;
