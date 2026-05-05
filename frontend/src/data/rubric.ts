/**
 * 22 academic-rubric criteria for the Supply Chain project.
 *
 * Each entry maps to:
 *  - `points`: the rubric weight,
 *  - `evidencePath`: in-app path that demonstrates the criterion,
 *  - `evidenceText`: short prose for the matrix.
 *
 * The matrix page also hits a couple of API endpoints to compute live status
 * (e.g. graph connected, all 8 datatypes present).
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
    title: "Nodes with labels and properties",
    points: 5,
    evidencePath: "/topology",
    evidenceText:
      "14 labels (Supplier, RawMaterial, Product, Warehouse, Customer, Inventory, etc.) with rich properties documented in docs/data_model.md.",
    liveCheck: "summary",
  },
  {
    id: 2,
    title: "Relationships with properties",
    points: 5,
    evidencePath: "/topology",
    evidenceText:
      "20 relationship types (SUPPLIES, USED_IN, CONNECTED_TO ...) carrying typed properties (unitCost, leadTimeDays, baseCost, status...).",
    liveCheck: "summary",
  },
  {
    id: 3,
    title: "All Neo4j data types",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "String, Integer, Float, Boolean (Supplier.isCertified), Date (Supplier.registeredOn), DateTime (Supplier.lastAuditAt), List<String> (Supplier.certifications), Point (Location.coords).",
    liveCheck: "dataTypes",
  },
  {
    id: 4,
    title: "CSV data ingestion",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Operations Lab → CSV Upload tab. Upload data/csv/*.csv with column-type mapping; backend uses MERGE/UNWIND.",
  },
  {
    id: 5,
    title: "Pre-loaded data",
    points: 2,
    evidencePath: "/topology",
    evidenceText:
      "scripts/seed_graph.py loads ~250 nodes + ~544 relationships idempotently from data/nodes.json and data/relationships.json.",
    liveCheck: "summary",
  },
  {
    id: 6,
    title: "Sufficient number of nodes",
    points: 2,
    evidencePath: "/",
    evidenceText: "Dashboard reports >250 nodes after seed.",
    liveCheck: "summary",
  },
  {
    id: 7,
    title: "Connected graph",
    points: 1,
    evidencePath: "/",
    evidenceText:
      "Dashboard 'Connectivity report' uses NetworkX weakly-connected components; the supply chain has 1 main component covering ~95% of nodes.",
    liveCheck: "connectivity",
  },
  {
    id: 8,
    title: "Topic / theme of the model",
    points: 5,
    evidencePath: "/",
    evidenceText:
      "Supply Chain Network Analysis & Optimization — clearly stated in the dashboard hero and README.",
  },
  {
    id: 9,
    title: "Create node with 1 label",
    points: 5,
    evidencePath: "/operations",
    evidenceText: "Operations Lab → Nodes → Create node with one label.",
  },
  {
    id: 10,
    title: "Create node with 2+ labels",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Operations Lab → Nodes → 'Add another label' chip lets you create e.g. (:Supplier:Certified).",
  },
  {
    id: 11,
    title: "Create node with properties (every type)",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Typed property editor offers all 8 Neo4j datatypes (string/int/float/boolean/date/datetime/list/point).",
  },
  {
    id: 12,
    title: "Visualise nodes",
    points: 5,
    evidencePath: "/topology",
    evidenceText:
      "Cytoscape.js graph with per-label colours, search, filtering and a property panel for the selected node.",
  },
  {
    id: 13,
    title: "Update node properties",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "PATCH /graph/nodes/{id} backed by typed property editor; also reachable from the Cypher Explorer in WRITE mode.",
  },
  {
    id: 14,
    title: "Create relationship with properties",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Operations Lab → Relationships → Create relationship with typed properties.",
  },
  {
    id: 15,
    title: "Update relationship (type/direction/endpoints/properties)",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Rewire dialog re-creates the edge with new type, endpoints or flipped direction (props copied) atomically.",
  },
  {
    id: 16,
    title: "Delete nodes",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "Operations Lab → Nodes → Trash icon (DETACH DELETE with a confirmation dialog).",
  },
  {
    id: 17,
    title: "Delete relationships",
    points: 5,
    evidencePath: "/operations",
    evidenceText: "Operations Lab → Relationships → Trash icon.",
  },
  {
    id: 18,
    title: "Delete properties from a node",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "PATCH /graph/nodes/{id} accepts a `remove: [keys]` field; reachable from the Cypher Explorer too.",
  },
  {
    id: 19,
    title: "Delete properties from a relationship",
    points: 5,
    evidencePath: "/operations",
    evidenceText:
      "PATCH /graph/relationships/{id} accepts `remove: [keys]`; same UI.",
  },
  {
    id: 20,
    title: "Cypher queries (15)",
    points: 15,
    evidencePath: "/queries",
    evidenceText:
      "Cypher Query Explorer ships 15 ready-made queries grouped in 5 categories plus a free-form editor with read/write switch.",
  },
  {
    id: 21,
    title: "Data Science algorithm(s)",
    points: 10,
    evidencePath: "/algorithms",
    evidenceText:
      "Algorithms page runs PageRank, Betweenness Centrality, Louvain Communities and Dijkstra Shortest Path via NetworkX. Centrality scores can be persisted onto Supplier nodes.",
  },
  {
    id: 22,
    title: "Outstanding interface",
    points: 5,
    evidencePath: "/",
    evidenceText:
      "Sidebar navigation, dashboard with live KPIs, Cytoscape graph with property inspector, toasts, confirm dialogs, dedicated rubric matrix, contextual algorithm interpretations.",
  },
];
