/**
 * Consultas Cypher predefinidas para el explorador (barra lateral).
 */

export type CypherPreset = {
  id: string;
  title: string;
  category: string;
  description: string;
  cypher: string;
  /** Optional placeholder parameters with friendly labels for the UI. */
  parameters?: { name: string; label: string; defaultValue: string }[];
};

const TRACE_PRODUCT = `
MATCH path=(s:Supplier)-[:SUPPLIES]->(rm:RawMaterial)-[:USED_IN]->(p:Product {id: $productId})
RETURN s.id AS supplierId, s.name AS supplierName, rm.id AS rawMaterialId, rm.name AS rawMaterialName,
       p.id AS productId, p.name AS productName
ORDER BY supplierId
`.trim();

const TRACE_SUPPLIER_CUSTOMERS = `
MATCH (s:Supplier {id: $supplierId})-[:SUPPLIES]->(rm:RawMaterial)-[:USED_IN]->(p:Product)
      <-[:FOR_PRODUCT]-(co:CustomerOrder)-[:PLACED_BY]->(c:Customer)
RETURN DISTINCT c.id AS customerId, c.name AS customer, p.id AS productId, count(co) AS ordersAffected
ORDER BY ordersAffected DESC
`.trim();

const TRACE_PATH_BETWEEN_LOCATIONS = `
MATCH (a:Location {id: $fromLocation}), (b:Location {id: $toLocation}),
      path = shortestPath((a)-[:CONNECTED_TO*..6]-(b))
RETURN [n IN nodes(path) | n.id] AS path, length(path) AS hops
`.trim();

export const CYPHER_PRESETS: CypherPreset[] = [
  {
    id: "disc.labels",
    title: "Q01 · Conteo por etiqueta de nodo",
    category: "Descubrimiento",
    description:
      "Cuenta nodos por etiqueta. Útil para comprobar que el seed cargó correctamente.",
    cypher:
      "MATCH (n)\nRETURN labels(n)[0] AS label, count(*) AS count\nORDER BY count DESC",
  },
  {
    id: "disc.reltypes",
    title: "Q02 · Conteo por tipo de relación",
    category: "Descubrimiento",
    description: "Cuenta relaciones por tipo. Comprobación rápida tras el seed.",
    cypher:
      "MATCH ()-[r]->()\nRETURN type(r) AS type, count(*) AS count\nORDER BY count DESC",
  },
  {
    id: "disc.types",
    title: "Q03 · Proveedor de ejemplo con tipos nativos",
    category: "Descubrimiento",
    description:
      "Fila de Supplier con propiedades temporales, lista y booleano nativas.",
    cypher: `
MATCH (s:Supplier {id: $supplierId})
RETURN s.id AS id, s.name AS name, s.country AS country,
       s.riskScore AS riskScore, s.capacityPerWeek AS capacity,
       s.isCertified AS isCertified, s.certifications AS certifications,
       s.registeredOn AS registeredOn, s.lastAuditAt AS lastAuditAt
`.trim(),
    parameters: [{ name: "supplierId", label: "Id proveedor", defaultValue: "S1" }],
  },

  {
    id: "trace.product",
    title: "Q04 · Proveedores y materias que alimentan un producto",
    category: "Trazabilidad",
    description: "Trazabilidad multi-salto desde un Product hasta sus Supplier.",
    cypher: TRACE_PRODUCT,
    parameters: [{ name: "productId", label: "Id producto", defaultValue: "P2" }],
  },
  {
    id: "trace.supplier",
    title: "Q05 · Clientes expuestos a un proveedor",
    category: "Trazabilidad",
    description:
      "Recorre Supplier → RawMaterial → Product → CustomerOrder → Customer.",
    cypher: TRACE_SUPPLIER_CUSTOMERS,
    parameters: [{ name: "supplierId", label: "Id proveedor", defaultValue: "S3" }],
  },
  {
    id: "trace.path",
    title: "Q06 · Camino más corto entre dos ubicaciones",
    category: "Trazabilidad",
    description:
      "shortestPath() sobre CONNECTED_TO entre dos Location (hasta 6 saltos).",
    cypher: TRACE_PATH_BETWEEN_LOCATIONS,
    parameters: [
      { name: "fromLocation", label: "Ubicación origen", defaultValue: "LOC1" },
      { name: "toLocation", label: "Ubicación destino", defaultValue: "LOC11" },
    ],
  },

  {
    id: "risk.singlesource",
    title: "Q07 · Materias con un único proveedor activo",
    category: "Riesgo y criticidad",
    description:
      "Materias primas abastecidas por un solo proveedor activo (punto único de fallo).",
    cypher: `
MATCH (rm:RawMaterial)<-[:SUPPLIES]-(s:Supplier)
WHERE s.status = 'active'
WITH rm, collect(DISTINCT s) AS suppliers
WHERE size(suppliers) = 1
RETURN rm.id AS rawMaterialId, rm.name AS rawMaterial,
       suppliers[0].id AS supplierId,
       suppliers[0].name AS supplier
ORDER BY rawMaterialId
`.trim(),
  },
  {
    id: "risk.top",
    title: "Q08 · Top 5 proveedores por riesgo",
    category: "Riesgo y criticidad",
    description: "Proveedores ordenados por riskScore (mayor riesgo primero).",
    cypher: `
MATCH (s:Supplier)
RETURN s.id AS id, s.name AS name, s.country AS country,
       s.status AS status, s.riskScore AS riskScore
ORDER BY riskScore DESC
LIMIT 5
`.trim(),
  },
  {
    id: "risk.disconnected",
    title: "Q09 · Proveedores sin SUPPLIES activo",
    category: "Riesgo y criticidad",
    description:
      "Proveedores inactivos o sin aristas SUPPLIES (no aparecerían en un plan).",
    cypher: `
MATCH (s:Supplier)
OPTIONAL MATCH (s)-[r:SUPPLIES]->(rm:RawMaterial)
WITH s, count(r) AS supplies
WHERE supplies = 0 OR s.status <> 'active'
RETURN s.id AS id, s.name AS name, s.status AS status, supplies
ORDER BY supplies, id
`.trim(),
  },

  {
    id: "inv.below",
    title: "Q10 · Inventario bajo stock de seguridad",
    category: "Inventario y demanda",
    description:
      "Nodos Inventory con quantity < safetyStock (candidatos a reabasto).",
    cypher: `
MATCH (w:Warehouse)-[:HAS_INVENTORY]->(i:Inventory)-[:OF_PRODUCT]->(p:Product)
WHERE i.quantity < i.safetyStock
RETURN w.id AS warehouseId, p.id AS productId, p.name AS product,
       i.quantity AS quantity, i.safetyStock AS safetyStock,
       (i.safetyStock - i.quantity) AS shortfall
ORDER BY shortfall DESC
`.trim(),
  },
  {
    id: "inv.due",
    title: "Q11 · Pedidos con entrega en los próximos N días",
    category: "Inventario y demanda",
    description:
      "CustomerOrder con dueDate en el horizonte indicado desde «hoy».",
    cypher: `
WITH date($today) AS today, $days AS days
MATCH (co:CustomerOrder)-[:FOR_PRODUCT]->(p:Product)
WHERE date(co.dueDate) >= today AND date(co.dueDate) <= today + duration({days: days})
RETURN co.id AS orderId, p.id AS productId, co.quantity AS quantity,
       co.priority AS priority, co.dueDate AS dueDate, co.revenue AS revenue
ORDER BY co.dueDate
`.trim(),
    parameters: [
      { name: "today", label: "Hoy (AAAA-MM-DD)", defaultValue: "2026-05-01" },
      { name: "days", label: "Horizonte (días)", defaultValue: "7" },
    ],
  },
  {
    id: "inv.demand",
    title: "Q12 · Demanda total por producto",
    category: "Inventario y demanda",
    description: "Suma de cantidades pendientes por Product en CustomerOrder.",
    cypher: `
MATCH (co:CustomerOrder)-[r:FOR_PRODUCT]->(p:Product)
WHERE co.status = 'pending'
RETURN p.id AS productId, p.name AS product, sum(r.quantity) AS pendingDemand
ORDER BY pendingDemand DESC
`.trim(),
  },

  {
    id: "meta.scenarios",
    title: "Q13 · Escenarios de disrupción activos con impactos",
    category: "Meta y avanzado",
    description:
      "Lista DisruptionScenario activos y entidades enlazadas por IMPACTS.",
    cypher: `
MATCH (ds:DisruptionScenario)-[:IMPACTS]->(target)
RETURN ds.id AS scenarioId, ds.type AS type, ds.status AS status,
       collect({label: labels(target)[0], id: target.id}) AS impacts
ORDER BY scenarioId
`.trim(),
  },
  {
    id: "meta.density",
    title: "Q14 · Grado medio por etiqueta",
    category: "Meta y avanzado",
    description:
      "Grado medio (entrada+salida) por etiqueta de nodo.",
    cypher: `
MATCH (n)
WITH labels(n)[0] AS label, n
OPTIONAL MATCH (n)-[r]-()
WITH label, n, count(r) AS deg
RETURN label, avg(toFloat(deg)) AS avgDegree, count(n) AS nodes
ORDER BY avgDegree DESC
`.trim(),
  },
  {
    id: "meta.list",
    title: "Q15 · Proveedores con al menos N certificaciones (lista)",
    category: "Meta y avanzado",
    description:
      "Filtra por propiedad tipo lista: size(s.certifications).",
    cypher: `
MATCH (s:Supplier)
WHERE s.certifications IS NOT NULL AND size(s.certifications) >= toInteger($minCount)
RETURN s.id AS id, s.name AS name, s.certifications AS certifications, s.isCertified AS isCertified
ORDER BY size(s.certifications) DESC, id
`.trim(),
    parameters: [{ name: "minCount", label: "Certificaciones mínimas", defaultValue: "3" }],
  },
];

export const CYPHER_CATEGORIES = Array.from(
  new Set(CYPHER_PRESETS.map((p) => p.category))
);
