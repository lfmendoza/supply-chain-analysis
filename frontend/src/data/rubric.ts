/**
 * Lista de criterios para la matriz (ids, puntos, enlaces de evidencia).
 * Las filas con `liveCheck` obtienen estado desde la API.
 */

export type RubricCriterion = {
  id: number;
  title: string;
  points: number;
  evidencePath: string;
  evidenceText: string;
  /** When set, status is auto-detected from this key. */
  liveCheck?: "connectivity" | "dataTypes" | "summary";
};

export const RUBRIC_TOTAL_POINTS = 110;

export const RUBRIC: RubricCriterion[] = [
  {
    id: 1,
    title: "Nodos con etiquetas y propiedades",
    points: 5,
    evidencePath: "/topology",
    evidenceText:
      "14 etiquetas (Supplier, RawMaterial, Product, Warehouse, Customer, Inventory, etc.) con propiedades documentadas en docs/data_model.md.",
    liveCheck: "summary",
  },
  {
    id: 2,
    title: "Relaciones con propiedades",
    points: 5,
    evidencePath: "/topology",
    evidenceText:
      "20 tipos de relación (SUPPLIES, USED_IN, CONNECTED_TO, …) con propiedades tipadas (unitCost, leadTimeDays, baseCost, status, …).",
    liveCheck: "summary",
  },
  {
    id: 3,
    title: "Todos los tipos de datos Neo4j",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "String, Integer, Float, Boolean (Supplier.isCertified), Date (Supplier.registeredOn), DateTime (Supplier.lastAuditAt), List<String> (Supplier.certifications), Point (Location.coords).",
    liveCheck: "dataTypes",
  },
  {
    id: 4,
    title: "Ingesta de datos CSV",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Laboratorio → pestaña CSV. Sube data/csv/*.csv con mapeo de tipos por columna; el backend usa MERGE/UNWIND.",
  },
  {
    id: 5,
    title: "Datos precargados",
    points: 2,
    evidencePath: "/topology",
    evidenceText:
      "scripts/seed_graph.py carga ~250 nodos y ~544 relaciones de forma idempotente desde data/nodes.json y data/relationships.json.",
    liveCheck: "summary",
  },
  {
    id: 6,
    title: "Número suficiente de nodos",
    points: 2,
    evidencePath: "/",
    evidenceText: "El panel muestra >250 nodos tras el seed.",
    liveCheck: "summary",
  },
  {
    id: 7,
    title: "Grafo conexo",
    points: 1,
    evidencePath: "/",
    evidenceText:
      "El informe de conectividad usa componentes débilmente conexas (NetworkX); la cadena tiene 1 componente principal (~95% de nodos).",
    liveCheck: "connectivity",
  },
  {
    id: 8,
    title: "Tema del modelo",
    points: 5,
    evidencePath: "/",
    evidenceText: "Título en el panel (`/`) y en README.md.",
  },
  {
    id: 9,
    title: "Crear nodo con 1 etiqueta",
    points: 5,
    evidencePath: "/operations",
    evidenceText: "Laboratorio → Nodos → Crear nodo con una etiqueta.",
  },
  {
    id: 10,
    title: "Crear nodo con 2+ etiquetas",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Laboratorio → Nodos → chip «Añadir otra etiqueta» permite p. ej. (:Supplier:Certified).",
  },
  {
    id: 11,
    title: "Crear nodo con propiedades (todos los tipos)",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Editor de propiedades tipadas con los 8 tipos Neo4j (string/int/float/boolean/date/datetime/list/point).",
  },
  {
    id: 12,
    title: "Visualizar nodos",
    points: 5,
    evidencePath: "/topology",
    evidenceText:
      "Grafo Cytoscape con colores por etiqueta, búsqueda, filtros y panel de propiedades al seleccionar.",
  },
  {
    id: 13,
    title: "Actualizar propiedades de nodo",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "PATCH /graph/nodes/{id} vía editor tipado; también desde el explorador Cypher en modo ESCRITURA.",
  },
  {
    id: 14,
    title: "Crear relación con propiedades",
    points: 5,
    evidencePath: "/operations",
    evidenceText: "Laboratorio → Relaciones → Crear relación con propiedades tipadas.",
  },
  {
    id: 15,
    title: "Actualizar relación (tipo/dirección/extremos/propiedades)",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Diálogo Reconectar recrea la arista con nuevo tipo, extremos o dirección invertida (copiando propiedades) de forma atómica.",
  },
  {
    id: 16,
    title: "Eliminar nodos",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Laboratorio → Nodos → icono papelera (DETACH DELETE con confirmación).",
  },
  {
    id: 17,
    title: "Eliminar relaciones",
    points: 5,
    evidencePath: "/operations",
    evidenceText: "Laboratorio → Relaciones → icono papelera.",
  },
  {
    id: 18,
    title: "Eliminar propiedades de un nodo",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "PATCH /graph/nodes/{id} acepta `remove: [claves]`; también desde Cypher.",
  },
  {
    id: 19,
    title: "Eliminar propiedades de una relación",
    points: 5,
    evidencePath: "/operations",
    evidenceText: "PATCH /graph/relationships/{id} acepta `remove: [claves]`; misma UI.",
  },
  {
    id: 20,
    title: "Consultas Cypher (15)",
    points: 15,
    evidencePath: "/queries",
    evidenceText:
      "Explorador Cypher: 15 consultas en 5 categorías más editor libre con interruptor lectura/escritura.",
  },
  {
    id: 21,
    title: "Algoritmo(s) de ciencia de datos",
    points: 10,
    evidencePath: "/algorithms",
    evidenceText:
      "Página Algoritmos: PageRank, betweenness, comunidades Louvain y Dijkstra vía NetworkX. La centralidad puede persistirse en nodos Supplier.",
  },
  {
    id: 22,
    title: "Interfaz destacada",
    points: 5,
    evidencePath: "/",
    evidenceText:
      "Navegación, panel, Cytoscape, panel de propiedades, toasts, confirmaciones, esta matriz, textos de algoritmos.",
  },
];
