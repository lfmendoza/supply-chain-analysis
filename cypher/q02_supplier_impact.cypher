// Q02 - Products affected by a supplier going down. Distinguishes critical
// (no alternative active supplier for the raw material) vs at-risk.
// Param: $supplierId
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
ORDER BY impact, productId;
