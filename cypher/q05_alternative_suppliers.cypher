// Q05 - Alternative active suppliers for a given raw material, scored by
// (unitCost + risk*100) so cheaper-and-safer options come first.
// Param: $rawMaterialId
MATCH (rm:RawMaterial {id: $rawMaterialId})<-[su:SUPPLIES]-(s:Supplier {status: 'active'})
RETURN s.id AS supplierId,
       s.name AS supplierName,
       su.unitCost AS unitCost,
       su.leadTimeDays AS leadTimeDays,
       s.riskScore AS riskScore,
       (su.unitCost + s.riskScore * 100) AS rankingScore
ORDER BY rankingScore ASC;
