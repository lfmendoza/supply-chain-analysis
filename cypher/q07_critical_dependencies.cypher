// Q07 - Single-source raw materials: those served by only one active supplier.
// Returns the at-risk products that depend on them.
MATCH (rm:RawMaterial)<-[:SUPPLIES]-(s:Supplier {status: 'active'})
WITH rm, count(s) AS activeSuppliers
WHERE activeSuppliers = 1
MATCH (rm)-[:USED_IN]->(p:Product)
WITH rm, activeSuppliers, collect(DISTINCT p.id) AS atRiskProductIds
RETURN rm.id AS rawMaterialId,
       rm.name AS rawMaterialName,
       activeSuppliers,
       atRiskProductIds
ORDER BY size(atRiskProductIds) DESC;
