// Q03 - Customer orders that have no warehouse with enough inventory.
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
ORDER BY priority ASC, revenue DESC;
