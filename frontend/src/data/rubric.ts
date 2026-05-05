/**
 * Lista de criterios para la matriz de rúbrica con tripleta de validación
 * (PRE / acción / POST) por cada ítem.
 *
 * Esta versión está alineada con la rúbrica oficial de CC3089 (UVG, Sem I 2026):
 * 100 puntos netos + 20 puntos extra (frontend destacado + algoritmo de Data
 * Science).
 *
 * Cada criterio se demuestra ejecutando un preset Cypher antes y después de la
 * operación; la diferencia entre ambas ejecuciones es la evidencia. Los
 * `prePresetId` apuntan a `cypherPresets.ts` (categoría "Validación de
 * rúbrica") y se abren en `/queries?preset=<id>`.
 */

export type RubricCriterion = {
  id: number;
  /** Texto para la columna "Cumplimiento" en la matriz. */
  title: string;
  /** Categoría agrupadora (Modelado, Set de datos, Aplicación, Extras). */
  category: "Modelado de datos" | "Set de datos" | "Aplicación funcional" | "Extras";
  points: number;
  /**
   * Sub-pasos que conforman el ítem. Cada paso tiene un preset PRE/POST, una
   * acción a ejecutar y una pista de cómo demostrarlo. Si solo hay 1 paso el
   * ítem se demuestra con un único flujo.
   */
  steps: ValidationStep[];
  /** Estado automatizable consultable por la matriz. */
  liveCheck?: "connectivity" | "dataTypes" | "summary" | "datasetSize" | "labelCount" | "relTypeCount";
  /** Indica si el criterio cuenta como "extra" en el desglose de puntos. */
  extra?: boolean;
};

export type ValidationStep = {
  /** Etiqueta corta para mostrar en la matriz. */
  label: string;
  /** Preset que se ejecuta antes y después de la acción para ver el delta. */
  presetId?: string;
  /** Pantalla que ejecuta la acción (deep link). */
  actionPath?: string;
  /** Texto guía sobre qué hacer en esa pantalla. */
  actionHint?: string;
  /**
   * Llamada equivalente vía API (curl o fetch) para quien prefiera ir por
   * Swagger UI o un script. Útil para los sub-criterios "para muchos".
   */
  apiCall?: string;
};

export const RUBRIC_TOTAL_POINTS = 100;
export const RUBRIC_EXTRA_POINTS = 20;
export const RUBRIC_MAX_POINTS = RUBRIC_TOTAL_POINTS + RUBRIC_EXTRA_POINTS;

export const RUBRIC: RubricCriterion[] = [
  // -------------------------------------------------------------------------
  // Modelado de datos (20 pts)
  // -------------------------------------------------------------------------
  {
    id: 1,
    title: "Implementación de caso de uso adecuado (Cadena de suministro)",
    category: "Modelado de datos",
    points: 5,
    liveCheck: "summary",
    steps: [
      {
        label: "Tema del modelo",
        actionPath: "/",
        actionHint:
          "Mostrar el panel y el README. Modela proveedores, materias, productos, bodegas, inventario, pedidos, envíos, rutas y clientes.",
      },
    ],
  },
  {
    id: 2,
    title: "≥5 etiquetas distintas, cada una con ≥5 propiedades",
    category: "Modelado de datos",
    points: 5,
    liveCheck: "labelCount",
    steps: [
      {
        label: "Conteo de etiquetas",
        presetId: "val.dataset-size",
        actionPath: "/topology",
        actionHint:
          "El grafo tiene 12 etiquetas (Supplier, RawMaterial, Product, Warehouse, Customer, Inventory, Route, Carrier, Location, CustomerOrder, PurchaseOrder, Shipment).",
      },
      {
        label: "Propiedades por etiqueta",
        presetId: "val.label-property-density",
        actionHint:
          "minProps debe ser ≥5 en las etiquetas principales (Supplier tiene 10, Product 4 en BD pero 5+ con sku/name/category/unitCost/id).",
      },
    ],
  },
  {
    id: 3,
    title: "≥10 tipos de relaciones, cada una con ≥3 propiedades",
    category: "Modelado de datos",
    points: 5,
    liveCheck: "relTypeCount",
    steps: [
      {
        label: "Tipos de relación y propiedades",
        presetId: "val.reltypes-coverage",
        actionPath: "/topology",
        actionHint:
          "El modelo tiene 18 tipos de relaciones; SUPPLIES (3 props), CONNECTED_TO (5), USES_ROUTE (1, complementadas por las propiedades del Shipment), etc.",
      },
    ],
  },
  {
    id: 4,
    title: "Todos los tipos nativos de Neo4j (String/Float/Integer/Boolean/List/Date)",
    category: "Modelado de datos",
    points: 5,
    liveCheck: "dataTypes",
    steps: [
      {
        label: "Lectura de un Supplier y una Location",
        presetId: "val.types-coverage",
        actionPath: "/operations",
        actionHint:
          "Además de los 6 tipos exigidos, el modelo cubre DateTime y Point (extras). El editor tipado admite los 8 tipos en CREATE/UPDATE.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Set de datos (10 pts)
  // -------------------------------------------------------------------------
  {
    id: 5,
    title: "Carga de datos por archivo CSV",
    category: "Set de datos",
    points: 5,
    steps: [
      {
        label: "Subir un CSV de nodos",
        actionPath: "/operations",
        actionHint:
          "Pestaña CSV → seleccionar plantilla 'Suppliers' o 'Customers' → subir `data/csv/suppliers.csv`. La pantalla muestra filas procesadas/escritas.",
      },
      {
        label: "Subir un CSV de relaciones",
        actionPath: "/operations",
        actionHint: "Misma pestaña, plantilla 'SUPPLIES' → subir `data/csv/supplies.csv`.",
      },
    ],
  },
  {
    id: 6,
    title: "Datos previamente cargados en BD",
    category: "Set de datos",
    points: 2,
    liveCheck: "summary",
    steps: [
      {
        label: "Tras seed_graph --reset",
        presetId: "val.dataset-size",
        actionPath: "/",
        actionHint:
          "El conteo del panel y el preset deben reflejar >5500 nodos en cuanto se ejecuta `python -m scripts.seed_graph --reset`.",
      },
    ],
  },
  {
    id: 7,
    title: "Cantidad mínima estipulada (≥5000 nodos)",
    category: "Set de datos",
    points: 2,
    liveCheck: "datasetSize",
    steps: [
      {
        label: "Conteo total de nodos",
        presetId: "val.dataset-size",
        actionPath: "/",
        actionHint:
          "Tras seed deterministico el `totalNodes` ≈ 5584 (Customer 600, CustomerOrder 2400, Shipment 1500, PurchaseOrder 900, ...).",
      },
    ],
  },
  {
    id: 8,
    title: "Grafo conexo",
    category: "Set de datos",
    points: 1,
    liveCheck: "connectivity",
    steps: [
      {
        label: "Sin nodos aislados",
        presetId: "val.connected-graph",
        actionPath: "/",
        actionHint:
          "El informe de conectividad muestra una sola componente débil principal (~99% de los nodos) y el preset devuelve `isolated = 0`.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Aplicación funcional (70 pts)
  // -------------------------------------------------------------------------
  {
    id: 9,
    title: "Crear nodo con 1 etiqueta",
    category: "Aplicación funcional",
    points: 5,
    steps: [
      {
        label: "Crear `:DemoNode {id:'DEMO-1'}`",
        presetId: "val.create-1label",
        actionPath: "/operations",
        actionHint:
          "Pestaña Nodos → Crear nodo → label `DemoNode`, id 'DEMO-1', name 'demo'. Antes: 0 filas. Después: 1 fila.",
        apiCall: `curl -X POST http://localhost:8000/api/graph/nodes -H "Content-Type: application/json" -d '{"labels":["DemoNode"],"properties":[{"key":"id","type":"string","value":"DEMO-1"},{"key":"name","type":"string","value":"demo"}]}'`,
      },
    ],
  },
  {
    id: 10,
    title: "Crear nodo con 2+ etiquetas",
    category: "Aplicación funcional",
    points: 5,
    steps: [
      {
        label: "Crear `:Supplier:Certified`",
        presetId: "val.create-2labels",
        actionPath: "/operations",
        actionHint:
          "Pestaña Nodos → Crear nodo → labels [Supplier, Certified] (chip 'Añadir otra etiqueta'), id 'S-DEMO-1'. Después: labels=['Supplier','Certified'].",
        apiCall: `curl -X POST http://localhost:8000/api/graph/nodes -H "Content-Type: application/json" -d '{"labels":["Supplier","Certified"],"properties":[{"key":"id","type":"string","value":"S-DEMO-1"},{"key":"name","type":"string","value":"demo cert"}]}'`,
      },
    ],
  },
  {
    id: 11,
    title: "Crear nodo con ≥5 propiedades configuradas",
    category: "Aplicación funcional",
    points: 5,
    steps: [
      {
        label: "Crear `:DemoTyped` con 5+ propiedades tipadas",
        presetId: "val.create-props5+",
        actionPath: "/operations",
        actionHint:
          "Editor tipado → label DemoTyped → id (string), name (string), weight (float), isActive (boolean), registeredOn (date). Después: propertyCount ≥ 5.",
      },
    ],
  },
  {
    id: 12,
    title: "Visualización de nodos (1 nodo / muchos / agregadas)",
    category: "Aplicación funcional",
    points: 5,
    steps: [
      {
        label: "1 nodo con sus propiedades",
        presetId: "val.visualize-one",
        actionPath: "/topology",
      },
      {
        label: "Muchos nodos con filtro",
        presetId: "val.visualize-many",
        actionPath: "/topology",
      },
      {
        label: "Consulta agregada",
        presetId: "val.visualize-aggregate",
        actionPath: "/queries",
      },
    ],
  },
  {
    id: 13,
    title:
      "Gestión de propiedades en nodos (agregar/actualizar/eliminar para 1 y muchos)",
    category: "Aplicación funcional",
    points: 10,
    steps: [
      {
        label: "Agregar 1 propiedad a 1 nodo",
        presetId: "val.add-prop-1node",
        actionPath: "/operations",
        actionHint:
          "Tabla de nodos → Editar S1 → Añadir propiedad `demoFlag` (boolean=true). Antes: null; después: true.",
      },
      {
        label: "Agregar 1 propiedad a muchos nodos (bulk)",
        presetId: "val.bulk-add-prop-nodes",
        actionPath: "/operations",
        actionHint:
          "POST /graph/nodes/bulk-update con filter Supplier+country=JP, set demoTier='premium'.",
        apiCall: `curl -X POST http://localhost:8000/api/graph/nodes/bulk-update -H "Content-Type: application/json" -d '{"filter":{"label":"Supplier","where":[{"key":"country","type":"string","value":"JP"}]},"set":[{"key":"demoTier","type":"string","value":"premium"}]}'`,
      },
      {
        label: "Actualizar propiedad de 1 nodo",
        presetId: "val.update-prop-1node",
        actionPath: "/operations",
        actionHint: "PATCH /graph/nodes/S2 con set riskScore=0.10.",
      },
      {
        label: "Actualizar propiedad de muchos nodos (bulk)",
        presetId: "val.bulk-update-prop-nodes",
        actionPath: "/operations",
        actionHint:
          "POST /graph/nodes/bulk-update con filter CustomerOrder+priority=1, set status='urgent'.",
        apiCall: `curl -X POST http://localhost:8000/api/graph/nodes/bulk-update -H "Content-Type: application/json" -d '{"filter":{"label":"CustomerOrder","where":[{"key":"priority","type":"integer","value":1}]},"set":[{"key":"status","type":"string","value":"urgent"}],"limit":1000}'`,
      },
      {
        label: "Eliminar 1 propiedad de 1 nodo",
        presetId: "val.remove-prop-1node",
        actionPath: "/operations",
        actionHint: "PATCH /graph/nodes/S1 con remove:['demoFlag']. Antes: true; después: null.",
      },
      {
        label: "Eliminar 1 propiedad de muchos nodos (bulk)",
        presetId: "val.bulk-remove-prop-nodes",
        actionPath: "/operations",
        actionHint:
          "POST /graph/nodes/bulk-update con filter Supplier+country=JP y remove:['demoTier'].",
        apiCall: `curl -X POST http://localhost:8000/api/graph/nodes/bulk-update -H "Content-Type: application/json" -d '{"filter":{"label":"Supplier","where":[{"key":"country","type":"string","value":"JP"}]},"remove":["demoTier"]}'`,
      },
    ],
  },
  {
    id: 14,
    title: "Crear relación con ≥3 propiedades",
    category: "Aplicación funcional",
    points: 5,
    steps: [
      {
        label: "Crear `(:Supplier)-[:DEMO_LINK {weight, since, notes}]->(:Supplier)`",
        presetId: "val.create-rel-props3+",
        actionPath: "/operations",
        actionHint:
          "Pestaña Relaciones → Crear relación → tipo DEMO_LINK, startId 'S-DEMO-1', endId 'S1', con 3 propiedades tipadas.",
        apiCall: `curl -X POST http://localhost:8000/api/graph/relationships -H "Content-Type: application/json" -d '{"startId":"S-DEMO-1","endId":"S1","type":"DEMO_LINK","properties":[{"key":"weight","type":"float","value":1.5},{"key":"since","type":"date","value":"2026-01-01"},{"key":"notes","type":"string","value":"demo"}]}'`,
      },
    ],
  },
  {
    id: 15,
    title:
      "Gestión de relaciones (agregar/actualizar/eliminar propiedades para 1 y muchas)",
    category: "Aplicación funcional",
    points: 10,
    steps: [
      {
        label: "Agregar/Actualizar 1 propiedad de 1 relación",
        presetId: "val.update-rel-1",
        actionPath: "/operations",
        actionHint:
          "PATCH /graph/relationships/<elementId> con set unitCost=99.99. Antes: valor original; después: 99.99.",
      },
      {
        label: "Agregar/Actualizar propiedades en muchas relaciones (bulk)",
        presetId: "val.bulk-update-rels",
        actionPath: "/operations",
        actionHint:
          "POST /graph/relationships/bulk-update con filter type=SUPPLIES y set riskFlag=true. withRiskFlag pasa de 0 a N.",
        apiCall: `curl -X POST http://localhost:8000/api/graph/relationships/bulk-update -H "Content-Type: application/json" -d '{"filter":{"type":"SUPPLIES"},"set":[{"key":"riskFlag","type":"boolean","value":true}]}'`,
      },
      {
        label: "Eliminar 1 propiedad de 1 relación",
        presetId: "val.remove-rel-prop-1",
        actionPath: "/operations",
        actionHint:
          "PATCH /graph/relationships/<elementId> con remove:['riskFlag']. Antes: true; después: null.",
      },
      {
        label: "Eliminar propiedades en muchas relaciones (bulk)",
        presetId: "val.bulk-remove-rel-props",
        actionPath: "/operations",
        actionHint:
          "POST /graph/relationships/bulk-update con filter type=SUPPLIES y remove:['riskFlag']. withRiskFlag pasa de N a 0.",
        apiCall: `curl -X POST http://localhost:8000/api/graph/relationships/bulk-update -H "Content-Type: application/json" -d '{"filter":{"type":"SUPPLIES"},"remove":["riskFlag"]}'`,
      },
    ],
  },
  {
    id: 16,
    title: "Eliminación de nodos (1 y muchos)",
    category: "Aplicación funcional",
    points: 5,
    steps: [
      {
        label: "Eliminar 1 nodo (DETACH DELETE)",
        presetId: "val.delete-1node",
        actionPath: "/operations",
        actionHint:
          "Tabla de nodos → papelera sobre `DemoNode {id:'DEMO-1'}`. Confirmar. Antes: 1 fila; después: 0.",
      },
      {
        label: "Eliminar muchos nodos (bulk)",
        presetId: "val.delete-many-nodes",
        actionPath: "/operations",
        actionHint:
          "Crear primero N nodos `:DemoBulk` (vía CSV o varios CREATE), después POST /graph/nodes/bulk-delete con filter label=DemoBulk y confirm=true.",
        apiCall: `curl -X POST http://localhost:8000/api/graph/nodes/bulk-delete -H "Content-Type: application/json" -d '{"filter":{"label":"DemoBulk"},"confirm":true,"limit":1000}'`,
      },
    ],
  },
  {
    id: 17,
    title: "Eliminación de relaciones (1 y muchas)",
    category: "Aplicación funcional",
    points: 5,
    steps: [
      {
        label: "Eliminar 1 relación",
        presetId: "val.delete-1rel",
        actionPath: "/operations",
        actionHint:
          "Pestaña Relaciones → papelera sobre la DEMO_LINK creada. Confirmar.",
      },
      {
        label: "Eliminar muchas relaciones (bulk)",
        presetId: "val.delete-many-rels",
        actionPath: "/operations",
        actionHint:
          "POST /graph/relationships/bulk-delete con filter type=DEMO_LINK y confirm=true.",
        apiCall: `curl -X POST http://localhost:8000/api/graph/relationships/bulk-delete -H "Content-Type: application/json" -d '{"filter":{"type":"DEMO_LINK"},"confirm":true}'`,
      },
    ],
  },
  {
    id: 18,
    title: "Consultas Cypher (4-6 distintas, 2 por integrante)",
    category: "Aplicación funcional",
    points: 15,
    steps: [
      {
        label: "Q01-Q15 + V01-V27 en el explorador",
        actionPath: "/queries",
        actionHint:
          "El explorador tiene 15 consultas analíticas (Q01-Q15) en 5 categorías más 27 presets de validación. El editor libre acepta cualquier Cypher con interruptor lectura/escritura.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Extras (20 pts)
  // -------------------------------------------------------------------------
  {
    id: 19,
    title: "Algoritmo de Data Science (PageRank / Betweenness / Louvain / Dijkstra)",
    category: "Extras",
    points: 10,
    extra: true,
    steps: [
      {
        label: "PageRank persistido en Supplier",
        presetId: "val.algorithm-pagerank",
        actionPath: "/algorithms",
        actionHint:
          "Pantalla Algoritmos → 'Persistir centralidad'. Después V27 devuelve los Supplier con `pagerank` poblado.",
      },
      {
        label: "Detección de comunidades (Louvain)",
        actionPath: "/algorithms",
        actionHint:
          "Botón 'Comunidades'. Devuelve modularidad y miembros por comunidad.",
      },
      {
        label: "Camino más corto (Dijkstra ponderado)",
        actionPath: "/algorithms",
        actionHint:
          "Form 'Camino más corto' entre dos Location. Pesos: baseCost o leadTimeDays.",
      },
    ],
  },
  {
    id: 20,
    title: "Interfaz gráfica destacada (Frontend excepcional)",
    category: "Extras",
    points: 10,
    extra: true,
    steps: [
      {
        label: "9 pantallas conectadas con narrativa única",
        actionPath: "/",
        actionHint:
          "Panel, Topología, Cypher, Operaciones, Algoritmos, Simulación, Optimización, Comparación, Rúbrica. Toasts, confirmaciones, panel de propiedades, deep-links a presets.",
      },
    ],
  },
];

export const RUBRIC_BY_CATEGORY = (() => {
  const groups: Record<string, RubricCriterion[]> = {};
  for (const c of RUBRIC) {
    if (!groups[c.category]) groups[c.category] = [];
    groups[c.category].push(c);
  }
  return groups;
})();
