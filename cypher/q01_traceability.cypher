// Q01 - Full traceability of a product back to suppliers and raw materials.
// Param: $productId (e.g. "P1")
MATCH path = (s:Supplier)-[:SUPPLIES]->(rm:RawMaterial)-[:USED_IN]->(p:Product {id: $productId})
RETURN s.id  AS supplierId,
       s.name AS supplierName,
       rm.id AS rawMaterialId,
       rm.name AS rawMaterialName,
       p.id AS productId,
       p.name AS productName;
