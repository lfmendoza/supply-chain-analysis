// Q09 - Aggregate impact: how many pending orders cannot be fulfilled and how
// much revenue is at stake.
MATCH (co:CustomerOrder {status: 'pending'})-[fp:FOR_PRODUCT]->(p:Product)
WHERE NOT EXISTS {
    MATCH (w:Warehouse)-[:HAS_INVENTORY]->(inv:Inventory)-[:OF_PRODUCT]->(p)
    WHERE inv.quantity >= fp.quantity
}
RETURN count(co) AS unfulfilled,
       sum(co.revenue) AS revenueAtRisk,
       collect(co.id)[..20] AS sampleOrderIds;
