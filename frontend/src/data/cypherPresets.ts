/**
 * Consultas Cypher predefinidas para el explorador (barra lateral).
 *
 * Hay tres categorías de presets:
 *   - Descubrimiento / Trazabilidad / Riesgo / Inventario / Meta: las 15 consultas
 *     analíticas originales que se demuestran al docente.
 *   - "Validación de rúbrica": snapshots PRE/POST diseñados para correrse dos
 *     veces (antes y después de cada operación CRUD) y evidenciar el delta
 *     directamente en Aura Console o en el explorador.
 */

export type CypherPreset = {
  id: string;
  title: string;
  category: string;
  description: string;
  cypher: string;
  /** Optional placeholder parameters with friendly labels for the UI. */
  parameters?: { name: string; label: string; defaultValue: string }[];
  /**
   * When the preset is part of a validation flow, lists the criteria from the
   * rubric matrix that it covers (used by the matrix to highlight which
   * presets are relevant to which row).
   */
  rubricCriteria?: number[];
  /**
   * Free-form text explaining what the preset is meant to evidence in the
   * "before" vs. "after" execution. Shown above the Cypher in the explorer.
   */
  validationHint?: string;
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

  // -------------------------------------------------------------------------
  // Validación de rúbrica - snapshots PRE/POST por criterio.
  //
  // Convención: cada preset retorna información estable que cambia ANTES vs.
  // DESPUÉS de la operación a evaluar. Se ejecuta primero (estado inicial),
  // se hace la operación desde la UI o un endpoint, y se reejecuta. El
  // delta entre las dos ejecuciones es la evidencia.
  // -------------------------------------------------------------------------

  {
    id: "val.dataset-size",
    title: "V01 · Tamaño del dataset (≥5000 nodos)",
    category: "Validación de rúbrica",
    description:
      "Conteo total de nodos y de etiquetas distintas. Evidencia 'cantidad mínima de nodos' y 'definición de ≥5 labels'.",
    rubricCriteria: [2, 7],
    validationHint:
      "Tras `seed_graph --reset` el conteo total debe superar 5000 y mostrar al menos 12 etiquetas distintas.",
    cypher: `
MATCH (n)
RETURN count(n) AS totalNodes,
       count(DISTINCT labels(n)[0]) AS distinctLabels,
       collect(DISTINCT labels(n)[0])[..15] AS sampleLabels
`.trim(),
  },
  {
    id: "val.label-property-density",
    title: "V02 · Propiedades por etiqueta",
    category: "Validación de rúbrica",
    description:
      "Mín/máx de propiedades por etiqueta de nodo. Evidencia que cada etiqueta tiene ≥5 propiedades.",
    rubricCriteria: [2],
    validationHint:
      "minProps debe ser ≥5 para todas las etiquetas relevantes (Supplier, Product, Warehouse, etc.).",
    cypher: `
MATCH (n)
WITH labels(n)[0] AS label, n
RETURN label,
       count(n) AS instances,
       min(size(keys(n))) AS minProps,
       max(size(keys(n))) AS maxProps
ORDER BY label
`.trim(),
  },
  {
    id: "val.reltypes-coverage",
    title: "V03 · Tipos de relaciones y propiedades",
    category: "Validación de rúbrica",
    description:
      "Cuenta tipos de relación distintos y mín/máx de propiedades por tipo. Evidencia ≥10 tipos y ≥3 propiedades cada uno.",
    rubricCriteria: [3],
    validationHint:
      "totalTypes debe ser ≥10 y la columna minProps debe ser ≥3 en los tipos con propiedades documentadas.",
    cypher: `
MATCH ()-[r]->()
WITH type(r) AS type, r
WITH type,
     count(r) AS instances,
     max(size(keys(r))) AS maxProps,
     min(size(keys(r))) AS minProps
WITH collect({type: type, instances: instances, minProps: minProps, maxProps: maxProps}) AS rows
RETURN size(rows) AS totalTypes, rows
`.trim(),
  },
  {
    id: "val.types-coverage",
    title: "V04 · Cobertura de los 8 tipos nativos de Neo4j",
    category: "Validación de rúbrica",
    description:
      "Lee un Supplier y una Location de muestra para evidenciar String, Integer, Float, Boolean, Date, DateTime, List<String> y Point.",
    rubricCriteria: [4],
    validationHint:
      "Las 8 columnas devueltas deben tener tipos String/Integer/Float/Boolean/Date/DateTime/List/Point.",
    cypher: `
MATCH (s:Supplier {id:$supplierId}), (l:Location {id:$locationId})
RETURN s.name           AS string_supplier,
       s.capacityPerWeek AS integer_capacity,
       s.riskScore       AS float_risk,
       s.isCertified     AS boolean_certified,
       s.certifications  AS list_certifications,
       s.registeredOn    AS date_registered,
       s.lastAuditAt     AS datetime_audit,
       l.coords          AS point_coords
`.trim(),
    parameters: [
      { name: "supplierId", label: "Id proveedor", defaultValue: "S1" },
      { name: "locationId", label: "Id ubicación", defaultValue: "LOC1" },
    ],
  },
  {
    id: "val.connected-graph",
    title: "V05 · Grafo conexo (sin nodos aislados)",
    category: "Validación de rúbrica",
    description:
      "Cuenta nodos sin ninguna relación. Evidencia 'grafo conexo' (debe ser 0 o muy bajo).",
    rubricCriteria: [8],
    validationHint:
      "isolated debe ser 0. Si crece tras una eliminación, hay nodos huérfanos.",
    cypher: `
MATCH (n)
WHERE NOT (n)--()
RETURN count(n) AS isolated, collect(n.id)[..10] AS sample
`.trim(),
  },

  {
    id: "val.create-1label",
    title: "V06 · Crear nodo con 1 etiqueta",
    category: "Validación de rúbrica",
    description:
      "Snapshot del nodo de demostración con etiqueta única `DemoNode`. Antes de la acción no devuelve filas; después de crearlo, devuelve 1.",
    rubricCriteria: [9],
    validationHint:
      "Crear el nodo desde /operations (o `CREATE (:DemoNode {id:'DEMO-1', name:'demo'})`) y reejecutar.",
    cypher: `
MATCH (n:DemoNode {id:$demoNodeId})
RETURN n.id AS id, labels(n) AS labels, properties(n) AS properties
`.trim(),
    parameters: [{ name: "demoNodeId", label: "Id del nodo demo", defaultValue: "DEMO-1" }],
  },
  {
    id: "val.create-2labels",
    title: "V07 · Crear nodo con 2+ etiquetas",
    category: "Validación de rúbrica",
    description:
      "Verifica que el nodo demo tenga las etiquetas `Supplier:Certified` simultáneamente.",
    rubricCriteria: [10],
    validationHint:
      "Crear el nodo con las 2 etiquetas desde /operations (chip 'Añadir otra etiqueta') y reejecutar.",
    cypher: `
MATCH (n:Supplier:Certified {id:$demoSupplierId})
RETURN n.id AS id, labels(n) AS labels, size(labels(n)) AS labelCount, properties(n) AS properties
`.trim(),
    parameters: [
      { name: "demoSupplierId", label: "Id proveedor demo", defaultValue: "S-DEMO-1" },
    ],
  },
  {
    id: "val.create-props5+",
    title: "V08 · Crear nodo con ≥5 propiedades",
    category: "Validación de rúbrica",
    description:
      "Devuelve la cantidad y los nombres de propiedades del nodo demo. Tras creación con todos los tipos, propertyCount ≥ 5.",
    rubricCriteria: [11],
    validationHint:
      "Crear `:DemoTyped {id, name, weight, isActive, registeredOn}` desde el editor tipado y reejecutar.",
    cypher: `
MATCH (n:DemoTyped {id:$demoTypedId})
RETURN n.id AS id, size(keys(n)) AS propertyCount, keys(n) AS propertyNames, properties(n) AS properties
`.trim(),
    parameters: [{ name: "demoTypedId", label: "Id nodo tipado", defaultValue: "DT-1" }],
  },

  {
    id: "val.visualize-one",
    title: "V09 · Consultar 1 nodo con sus propiedades",
    category: "Validación de rúbrica",
    description:
      "Filtra un único Supplier por id y devuelve todas sus propiedades nativas. Evidencia 'consultar 1 nodo'.",
    rubricCriteria: [12],
    cypher: `
MATCH (s:Supplier {id:$supplierId})
RETURN s.id AS id, s.name AS name, s.country AS country,
       s.riskScore AS riskScore, s.capacityPerWeek AS capacity,
       s.isCertified AS isCertified, s.certifications AS certifications,
       s.registeredOn AS registeredOn, s.lastAuditAt AS lastAuditAt,
       s.status AS status
`.trim(),
    parameters: [{ name: "supplierId", label: "Id proveedor", defaultValue: "S1" }],
  },
  {
    id: "val.visualize-many",
    title: "V10 · Consultar muchos nodos con filtro",
    category: "Validación de rúbrica",
    description:
      "Devuelve los Supplier ordenados por riesgo. Evidencia 'consultar muchos nodos'.",
    rubricCriteria: [12],
    cypher: `
MATCH (s:Supplier)
RETURN s.id AS id, s.name AS name, s.country AS country, s.status AS status, s.riskScore AS riskScore
ORDER BY s.riskScore DESC
LIMIT 20
`.trim(),
  },
  {
    id: "val.visualize-aggregate",
    title: "V11 · Consulta agregada (demanda por producto)",
    category: "Validación de rúbrica",
    description:
      "Suma cantidades pendientes y cuenta órdenes por producto. Evidencia 'consultas agregadas'.",
    rubricCriteria: [12],
    cypher: `
MATCH (co:CustomerOrder)-[r:FOR_PRODUCT]->(p:Product)
WHERE co.status = 'pending'
RETURN p.id AS productId, p.name AS product,
       count(co) AS orderCount,
       sum(r.quantity) AS pendingDemand,
       avg(co.priority) AS avgPriority
ORDER BY pendingDemand DESC
LIMIT 10
`.trim(),
  },

  {
    id: "val.add-prop-1node",
    title: "V12 · Añadir propiedad a 1 nodo",
    category: "Validación de rúbrica",
    description:
      "Antes: la propiedad `demoFlag` es null. Después de PATCH /graph/nodes/{id} con set, devuelve true.",
    rubricCriteria: [13],
    validationHint:
      "PATCH /graph/nodes/$nodeId con `{set:[{key:'demoFlag', type:'boolean', value:true}]}` y reejecutar.",
    cypher: `
MATCH (n {id:$nodeId})
RETURN n.id AS id, labels(n) AS labels, n.demoFlag AS demoFlag, n.demoTier AS demoTier
`.trim(),
    parameters: [{ name: "nodeId", label: "Id del nodo", defaultValue: "S1" }],
  },
  {
    id: "val.bulk-add-prop-nodes",
    title: "V13 · Añadir propiedad a muchos nodos (bulk)",
    category: "Validación de rúbrica",
    description:
      "Antes: ningún Supplier de Japón tiene `demoTier`. Después de POST /graph/nodes/bulk-update con filter Supplier+country=JP y set demoTier=premium, todos lo tienen.",
    rubricCriteria: [13],
    validationHint:
      "POST /graph/nodes/bulk-update con `filter:{label:'Supplier', where:[{key:'country', type:'string', value:'JP'}]}, set:[{key:'demoTier', type:'string', value:'premium'}]`.",
    cypher: `
MATCH (s:Supplier {country:'JP'})
RETURN s.id AS id, s.name AS name, s.demoTier AS demoTier
ORDER BY s.id
`.trim(),
  },
  {
    id: "val.update-prop-1node",
    title: "V14 · Actualizar propiedad de 1 nodo",
    category: "Validación de rúbrica",
    description:
      "Antes: lee riskScore y capacityPerWeek originales. Después de PATCH con valores nuevos, reflejarán el cambio.",
    rubricCriteria: [13],
    cypher: `
MATCH (s:Supplier {id:$supplierId})
RETURN s.id AS id, s.name AS name, s.riskScore AS riskScore, s.capacityPerWeek AS capacity
`.trim(),
    parameters: [{ name: "supplierId", label: "Id proveedor", defaultValue: "S2" }],
  },
  {
    id: "val.bulk-update-prop-nodes",
    title: "V15 · Actualizar propiedad en muchos nodos (bulk)",
    category: "Validación de rúbrica",
    description:
      "Antes/después: muestra el `status` de los CustomerOrder con priority=1. POST /graph/nodes/bulk-update marca todos como 'urgent'.",
    rubricCriteria: [13],
    cypher: `
MATCH (co:CustomerOrder {priority:1})
RETURN count(co) AS total,
       collect(DISTINCT co.status)[..5] AS statuses,
       collect(co.id)[..5] AS sampleIds
`.trim(),
  },
  {
    id: "val.remove-prop-1node",
    title: "V16 · Eliminar propiedad de 1 nodo",
    category: "Validación de rúbrica",
    description:
      "Antes: `demoFlag` está poblada. Después de PATCH con remove:['demoFlag'], es null.",
    rubricCriteria: [13],
    cypher: `
MATCH (n {id:$nodeId})
RETURN n.id AS id, n.demoFlag AS demoFlag, n.demoTier AS demoTier, keys(n) AS keys
`.trim(),
    parameters: [{ name: "nodeId", label: "Id del nodo", defaultValue: "S1" }],
  },
  {
    id: "val.bulk-remove-prop-nodes",
    title: "V17 · Eliminar propiedad en muchos nodos (bulk)",
    category: "Validación de rúbrica",
    description:
      "POST /graph/nodes/bulk-update con remove:['demoTier'] y filter Supplier+country=JP. Antes: cada Supplier-JP tiene demoTier; después: null.",
    rubricCriteria: [13],
    cypher: `
MATCH (s:Supplier {country:'JP'})
RETURN s.id AS id, s.demoTier AS demoTier
ORDER BY s.id
`.trim(),
  },

  {
    id: "val.create-rel-props3+",
    title: "V18 · Crear relación con ≥3 propiedades",
    category: "Validación de rúbrica",
    description:
      "Verifica que la relación demo entre dos nodos tenga al menos 3 propiedades.",
    rubricCriteria: [14],
    validationHint:
      "Crear `(:Supplier {id:'S-DEMO-1'})-[:DEMO_LINK {weight:1.5, since:date('2026-01-01'), notes:'demo'}]->(:Supplier {id:'S1'})` desde /operations.",
    cypher: `
MATCH (a {id:$startId})-[r]->(b {id:$endId})
WHERE type(r) = $relType
RETURN type(r) AS type, size(keys(r)) AS propertyCount, keys(r) AS keys, properties(r) AS properties
`.trim(),
    parameters: [
      { name: "startId", label: "Id origen", defaultValue: "S-DEMO-1" },
      { name: "endId", label: "Id destino", defaultValue: "S1" },
      { name: "relType", label: "Tipo de relación", defaultValue: "DEMO_LINK" },
    ],
  },
  {
    id: "val.update-rel-1",
    title: "V19 · Actualizar propiedades de 1 relación",
    category: "Validación de rúbrica",
    description:
      "Antes/después: lee las propiedades de una relación SUPPLIES específica.",
    rubricCriteria: [15],
    validationHint:
      "PATCH /graph/relationships/{elementId} con `{set:[{key:'unitCost', type:'float', value:99.99}]}` y reejecutar.",
    cypher: `
MATCH (s:Supplier {id:$supplierId})-[r:SUPPLIES]->(rm:RawMaterial {id:$rawMaterialId})
RETURN elementId(r) AS relElementId, type(r) AS type, properties(r) AS properties
`.trim(),
    parameters: [
      { name: "supplierId", label: "Id proveedor", defaultValue: "S1" },
      { name: "rawMaterialId", label: "Id materia prima", defaultValue: "RM-E" },
    ],
  },
  {
    id: "val.bulk-update-rels",
    title: "V20 · Actualizar propiedades en muchas relaciones (bulk)",
    category: "Validación de rúbrica",
    description:
      "Antes: relaciones SUPPLIES sin la propiedad `riskFlag`. Después de POST /graph/relationships/bulk-update, todas la tienen.",
    rubricCriteria: [15],
    validationHint:
      "POST /graph/relationships/bulk-update con `filter:{type:'SUPPLIES'}, set:[{key:'riskFlag', type:'boolean', value:true}]`.",
    cypher: `
MATCH ()-[r:SUPPLIES]->()
RETURN count(r) AS total,
       sum(CASE WHEN r.riskFlag IS NOT NULL THEN 1 ELSE 0 END) AS withRiskFlag,
       avg(r.unitCost) AS avgCost
`.trim(),
  },
  {
    id: "val.remove-rel-prop-1",
    title: "V21 · Eliminar propiedad de 1 relación",
    category: "Validación de rúbrica",
    description: "PATCH con remove:['riskFlag'] sobre una relación SUPPLIES y reejecutar.",
    rubricCriteria: [15],
    cypher: `
MATCH (s:Supplier {id:$supplierId})-[r:SUPPLIES]->(rm:RawMaterial {id:$rawMaterialId})
RETURN elementId(r) AS relElementId, r.riskFlag AS riskFlag, keys(r) AS keys
`.trim(),
    parameters: [
      { name: "supplierId", label: "Id proveedor", defaultValue: "S1" },
      { name: "rawMaterialId", label: "Id materia prima", defaultValue: "RM-E" },
    ],
  },
  {
    id: "val.bulk-remove-rel-props",
    title: "V22 · Eliminar propiedad en muchas relaciones (bulk)",
    category: "Validación de rúbrica",
    description:
      "POST /graph/relationships/bulk-update con `filter:{type:'SUPPLIES'}, remove:['riskFlag']`. La columna withRiskFlag pasa de N a 0.",
    rubricCriteria: [15],
    cypher: `
MATCH ()-[r:SUPPLIES]->()
RETURN count(r) AS total,
       sum(CASE WHEN r.riskFlag IS NOT NULL THEN 1 ELSE 0 END) AS withRiskFlag
`.trim(),
  },

  {
    id: "val.delete-1node",
    title: "V23 · Eliminar 1 nodo",
    category: "Validación de rúbrica",
    description: "Antes: 1 fila. Después de DELETE /graph/nodes/{id}: 0 filas.",
    rubricCriteria: [16],
    cypher: `
MATCH (n:DemoNode {id:$demoNodeId})
RETURN n.id AS id, labels(n) AS labels, properties(n) AS properties
`.trim(),
    parameters: [{ name: "demoNodeId", label: "Id del nodo demo", defaultValue: "DEMO-1" }],
  },
  {
    id: "val.delete-many-nodes",
    title: "V24 · Eliminar muchos nodos (bulk)",
    category: "Validación de rúbrica",
    description:
      "POST /graph/nodes/bulk-delete con filter `:DemoBulk`. Antes: count > 0; después: 0.",
    rubricCriteria: [16],
    validationHint:
      "Crear primero N nodos `:DemoBulk` (CSV o varios CREATE), reejecutar V24 (count=N), llamar bulk-delete con confirm=true, reejecutar (count=0).",
    cypher: `
MATCH (n:DemoBulk)
RETURN count(n) AS remaining, collect(n.id)[..10] AS sampleIds
`.trim(),
  },

  {
    id: "val.delete-1rel",
    title: "V25 · Eliminar 1 relación",
    category: "Validación de rúbrica",
    description:
      "Antes: la relación DEMO_LINK existe. Después de DELETE /graph/relationships/{elementId}: no.",
    rubricCriteria: [17],
    cypher: `
MATCH (a {id:$startId})-[r:DEMO_LINK]->(b {id:$endId})
RETURN elementId(r) AS relElementId, type(r) AS type, properties(r) AS properties
`.trim(),
    parameters: [
      { name: "startId", label: "Id origen", defaultValue: "S-DEMO-1" },
      { name: "endId", label: "Id destino", defaultValue: "S1" },
    ],
  },
  {
    id: "val.delete-many-rels",
    title: "V26 · Eliminar muchas relaciones (bulk)",
    category: "Validación de rúbrica",
    description:
      "POST /graph/relationships/bulk-delete con `filter:{type:'DEMO_LINK'}`. Antes: count > 0; después: 0.",
    rubricCriteria: [17],
    cypher: `
MATCH ()-[r:DEMO_LINK]->()
RETURN count(r) AS remaining
`.trim(),
  },

  {
    id: "val.algorithm-pagerank",
    title: "V27 · PageRank persistido en Supplier",
    category: "Validación de rúbrica",
    description:
      "Tras POST /algorithms/persist-centrality, los Supplier tienen propiedad `pagerank` poblada.",
    rubricCriteria: [19],
    cypher: `
MATCH (s:Supplier)
WHERE s.pagerank IS NOT NULL
RETURN s.id AS id, s.name AS name, s.pagerank AS pagerank
ORDER BY s.pagerank DESC
LIMIT 10
`.trim(),
  },
];

export const CYPHER_CATEGORIES = Array.from(
  new Set(CYPHER_PRESETS.map((p) => p.category))
);
