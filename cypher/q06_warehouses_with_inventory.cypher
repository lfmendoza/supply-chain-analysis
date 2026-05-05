// Q06 - Warehouses that have enough inventory to fulfill a given order.
// Param: $orderId
MATCH (co:CustomerOrder {id: $orderId})-[fp:FOR_PRODUCT]->(p:Product),
      (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p)
WHERE inv.quantity >= fp.quantity
RETURN w.id AS warehouseId,
       w.name AS warehouseName,
       inv.quantity AS available,
       fp.quantity AS required,
       w.region AS region
ORDER BY available DESC;
