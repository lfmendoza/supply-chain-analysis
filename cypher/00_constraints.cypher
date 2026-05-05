// Uniqueness constraints (one per label that has an `id`).
// All statements are idempotent (IF NOT EXISTS) so this file can be re-run safely.

CREATE CONSTRAINT supplier_id IF NOT EXISTS FOR (n:Supplier) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT product_id IF NOT EXISTS FOR (n:Product) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT warehouse_id IF NOT EXISTS FOR (n:Warehouse) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT customer_order_id IF NOT EXISTS FOR (n:CustomerOrder) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT location_id IF NOT EXISTS FOR (n:Location) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT raw_material_id IF NOT EXISTS FOR (n:RawMaterial) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT carrier_id IF NOT EXISTS FOR (n:Carrier) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT inventory_id IF NOT EXISTS FOR (n:Inventory) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT shipment_id IF NOT EXISTS FOR (n:Shipment) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT customer_id IF NOT EXISTS FOR (n:Customer) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT route_id IF NOT EXISTS FOR (n:Route) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT purchase_order_id IF NOT EXISTS FOR (n:PurchaseOrder) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT disruption_id IF NOT EXISTS FOR (n:DisruptionScenario) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT optimized_assignment_id IF NOT EXISTS FOR (n:OptimizedAssignment) REQUIRE n.id IS UNIQUE;

// Secondary indexes to accelerate frequent filters.

CREATE INDEX supplier_status IF NOT EXISTS FOR (n:Supplier) ON (n.status);
CREATE INDEX supplier_risk IF NOT EXISTS FOR (n:Supplier) ON (n.riskScore);
CREATE INDEX product_category IF NOT EXISTS FOR (n:Product) ON (n.category);
CREATE INDEX customer_order_status IF NOT EXISTS FOR (n:CustomerOrder) ON (n.status);
CREATE INDEX customer_order_priority IF NOT EXISTS FOR (n:CustomerOrder) ON (n.priority);
CREATE INDEX inventory_qty IF NOT EXISTS FOR (n:Inventory) ON (n.quantity);
CREATE INDEX disruption_status IF NOT EXISTS FOR (n:DisruptionScenario) ON (n.status);
