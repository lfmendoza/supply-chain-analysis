import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE ?? "/api";

export const api = axios.create({ baseURL, timeout: 60000 });

// ---------------------------------------------------------------------------
// Topology / graph summary
// ---------------------------------------------------------------------------

export type GraphSummary = {
  counts: Record<string, number>;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
};

export type TopologyNode = {
  id: string;
  label: string;
  name: string;
  status?: string;
  riskScore?: number | null;
};

export type TopologyEdge = {
  source: string;
  target: string;
  relType: string;
  status?: string | null;
  cost?: number | null;
};

// ---------------------------------------------------------------------------
// Simulation / Optimization / ML
// ---------------------------------------------------------------------------

export type SimulationRun = {
  scenarioId: string;
  type: string;
  createdAt: string;
  params: Record<string, unknown>;
  impacts: unknown[];
};

export type Scenario = {
  id: string;
  type: string;
  description: string;
  status: string;
  createdAt: string;
  impactsCount: number;
};

export type Assignment = {
  orderId: string;
  warehouseId: string;
  cost: number;
  leadTime: number;
  risk: number;
};

export type OptimizationResult = {
  assignmentId: string;
  scenarioId: string;
  status: string;
  objectiveValue: number;
  runtimeMs: number;
  weights: { alpha: number; beta: number; gamma: number; delta: number };
  diagnostics: Record<string, number>;
  assignments: Assignment[];
  unfulfilledOrderIds: string[];
};

export type StateMetrics = {
  state: string;
  totalCost: number;
  avgLeadTime: number;
  fulfillmentPct: number;
  ordersAffected: number;
  revenueAtRisk: number;
  riskWeighted: number;
  avgRisk: number;
  assignedOrders: number;
  totalOrders: number;
  warehouseUsage: Record<string, { used: number; capacity: number }>;
};

export type Comparison = {
  scenarioId: string;
  base: StateMetrics;
  disrupted: StateMetrics;
  optimized: StateMetrics;
  deltas: {
    costRecovered: number;
    ordersRecovered: number;
    fulfillmentImprovement: number;
    leadTimeImprovement: number;
    revenueRecovered: number;
  };
};

// ---------------------------------------------------------------------------
// CRUD / Cypher / Algorithms / CSV / analysis-meta
// ---------------------------------------------------------------------------

export type PropertyType =
  | "string"
  | "integer"
  | "float"
  | "boolean"
  | "date"
  | "datetime"
  | "list"
  | "point";

export type TypedProperty = { key: string; type: PropertyType; value: unknown };

export type GraphNode = {
  elementId: string;
  labels: string[];
  properties: Record<string, unknown>;
};

export type GraphRelationship = {
  elementId: string;
  type: string;
  startId?: string;
  endId?: string;
  startElementId?: string;
  endElementId?: string;
  startLabel?: string;
  endLabel?: string;
  properties: Record<string, unknown>;
};

export type BulkUpdateResult = {
  matched: number;
  updated: number;
  set: string[];
  removed: string[];
  sampleElementIds: string[];
  sampleIds?: string[];
  sampleTypes?: string[];
};

export type BulkDeleteResult = {
  deleted: number;
  sampleElementIds: string[];
  sampleIds?: string[];
  sampleTypes?: string[];
};

export type CypherStats = Record<string, number>;

export type CypherResult = {
  mode: "read" | "write";
  rowCount: number;
  rows: Array<Record<string, unknown>>;
  stats: CypherStats;
  columns: string[];
};

export type ConnectivityReport = {
  nodes: number;
  relationships: number;
  components: number;
  largestComponentSize: number;
  largestComponentRatio: number;
  isConnected: boolean;
  isolatedNodes: { id: string; label: string }[];
  componentSummary: { size: number; sampleNodes: string[] }[];
};

export type DataTypeReport = {
  typesSeen: string[];
  coverage: Record<
    | "String"
    | "Integer"
    | "Float"
    | "Boolean"
    | "Date"
    | "DateTime"
    | "List"
    | "Point",
    boolean
  >;
  details: Array<{
    label?: string;
    relationshipType?: string;
    property: string;
    types: string[];
    logicalTypes: string[];
  }>;
};

export type CentralityRow = {
  id: string;
  label: string;
  name?: string | null;
  score: number;
};

export type CentralityResult = {
  algorithm: string;
  topN: number;
  results: CentralityRow[];
  interpretation: string;
  weight?: string;
};

export type CommunitySummary = {
  communityId: number;
  size: number;
  byLabel: Record<string, number>;
  sample: { id: string; label: string; name?: string | null }[];
};

export type CommunitiesResult = {
  algorithm: string;
  modularity: number;
  totalCommunities: number;
  communities: CommunitySummary[];
  membership: Record<string, number>;
  interpretation: string;
};

export type ShortestPathResult = {
  algorithm: string;
  weight: string;
  directed: boolean;
  found: boolean;
  reason?: string;
  path: string[];
  nodes?: { id: string; label: string; name?: string | null }[];
  edgeKeys?: string[];
  hops?: number;
  totalWeight?: number | null;
  interpretation?: string;
};

export type CsvTemplate = {
  name: string;
  kind: "nodes" | "relationships";
  label?: string;
  relationshipType?: string;
  fromLabel?: string;
  toLabel?: string;
  idColumn?: string;
  fromColumn?: string;
  toColumn?: string;
  columns: { name: string; type: string }[];
  pointColumns?: { key: string; latitudeColumn: string; longitudeColumn: string }[];
  additionalLabels?: string[];
  listSeparator?: string;
  description?: string;
  available?: boolean;
  downloadPath?: string | null;
};

export type CsvUploadResult = {
  processed: number;
  written: number;
  errors: { row?: number; column?: string; error: string }[];
  elapsedMs: number;
  sampleRow: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const SupplyChainApi = {
  // health & topology
  health: () => api.get<{ status: string }>("/health").then((r) => r.data),
  healthNeo4j: () => api.get<{ status: string; message: string }>("/health/neo4j").then((r) => r.data),
  graphSummary: () => api.get<GraphSummary>("/graph/summary").then((r) => r.data),

  // ready-made multi-hop queries (kept for the original Traceability page)
  productTraceability: (id: string) => api.get(`/products/${id}/traceability`).then((r) => r.data),
  supplierImpact: (id: string) => api.get(`/suppliers/${id}/impact`).then((r) => r.data),
  alternativeSuppliers: (rmId: string) => api.get(`/materials/${rmId}/alternatives`).then((r) => r.data),
  criticalDependencies: () => api.get(`/analysis/critical-dependencies`).then((r) => r.data),
  unfulfillableOrders: () => api.get(`/orders/unfulfillable`).then((r) => r.data),

  // simulation
  scenarios: () => api.get<Scenario[]>(`/simulation/scenarios`).then((r) => r.data),
  scenarioImpacts: (id: string) => api.get(`/simulation/scenarios/${id}/impacts`).then((r) => r.data),
  runSimulation: (payload: { type: string; params: Record<string, unknown>; description?: string }) =>
    api.post<SimulationRun>("/simulation/run", payload).then((r) => r.data),
  revertSimulation: (id: string) => api.post(`/simulation/revert/${id}`).then((r) => r.data),

  // optimization
  runOptimization: (payload: { scenarioId?: string | null; weights?: Record<string, number>; timeLimitSeconds?: number }) =>
    api.post<OptimizationResult>("/optimization/run", payload).then((r) => r.data),
  comparison: (scenarioId: string) =>
    api.get<Comparison>(`/optimization/scenarios/${scenarioId}/comparison`).then((r) => r.data),

  // ML
  refreshSupplierRisk: () => api.get(`/ml/supplier-risk`).then((r) => r.data),
  trainSupplierRisk: () => api.post(`/ml/supplier-risk/train`).then((r) => r.data),

  // generic CRUD (Operations Lab)
  listLabels: () => api.get<{ labels: string[] }>("/graph/labels").then((r) => r.data.labels),
  listRelationshipTypes: () =>
    api.get<{ relationshipTypes: string[] }>("/graph/relationship-types").then((r) => r.data.relationshipTypes),
  listNodes: (params: { label?: string; limit?: number; skip?: number; search?: string }) =>
    api
      .get<{ items: GraphNode[]; skip: number; limit: number }>("/graph/nodes", { params })
      .then((r) => r.data),
  listRelationships: (params: { type?: string; limit?: number; skip?: number }) =>
    api
      .get<{ items: GraphRelationship[]; skip: number; limit: number }>("/graph/relationships", { params })
      .then((r) => r.data),
  createNode: (payload: { labels: string[]; properties: TypedProperty[] }) =>
    api.post<GraphNode>("/graph/nodes", payload).then((r) => r.data),
  updateNode: (key: string, payload: { set?: TypedProperty[]; remove?: string[] }, by: "id" | "elementId" = "id") =>
    api.patch<GraphNode>(`/graph/nodes/${encodeURIComponent(key)}`, payload, { params: { by } }).then((r) => r.data),
  deleteNode: (key: string, by: "id" | "elementId" = "id", detach = true) =>
    api.delete<{ deleted: true }>(`/graph/nodes/${encodeURIComponent(key)}`, { params: { by, detach } }).then((r) => r.data),
  removeNodeProperty: (key: string, prop: string, by: "id" | "elementId" = "id") =>
    api
      .delete<GraphNode>(`/graph/nodes/${encodeURIComponent(key)}/properties/${encodeURIComponent(prop)}`, { params: { by } })
      .then((r) => r.data),
  createRelationship: (payload: {
    startId: string;
    endId: string;
    type: string;
    properties: TypedProperty[];
    startLabel?: string;
    endLabel?: string;
  }) => api.post<GraphRelationship>("/graph/relationships", payload).then((r) => r.data),
  updateRelationship: (relId: string, payload: { set?: TypedProperty[]; remove?: string[] }) =>
    api.patch<GraphRelationship>(`/graph/relationships/${encodeURIComponent(relId)}`, payload).then((r) => r.data),
  rewireRelationship: (
    relId: string,
    payload: { newType?: string; newStartId?: string; newEndId?: string; flipDirection?: boolean }
  ) =>
    api.post<GraphRelationship>(`/graph/relationships/${encodeURIComponent(relId)}/rewire`, payload).then((r) => r.data),
  deleteRelationship: (relId: string) =>
    api.delete<{ deleted: true }>(`/graph/relationships/${encodeURIComponent(relId)}`).then((r) => r.data),
  removeRelationshipProperty: (relId: string, prop: string) =>
    api
      .delete<GraphRelationship>(
        `/graph/relationships/${encodeURIComponent(relId)}/properties/${encodeURIComponent(prop)}`
      )
      .then((r) => r.data),

  // bulk operations (multiple nodes / relationships at a time)
  bulkUpdateNodes: (payload: {
    filter: { label?: string; where?: TypedProperty[]; ids?: string[] };
    set?: TypedProperty[];
    remove?: string[];
    limit?: number;
  }) => api.post<BulkUpdateResult>("/graph/nodes/bulk-update", payload).then((r) => r.data),
  bulkDeleteNodes: (payload: {
    filter: { label?: string; where?: TypedProperty[]; ids?: string[] };
    confirm: boolean;
    limit?: number;
  }) => api.post<BulkDeleteResult>("/graph/nodes/bulk-delete", payload).then((r) => r.data),
  bulkUpdateRelationships: (payload: {
    filter: {
      type?: string;
      where?: TypedProperty[];
      elementIds?: string[];
      startLabel?: string;
      endLabel?: string;
    };
    set?: TypedProperty[];
    remove?: string[];
    limit?: number;
  }) =>
    api
      .post<BulkUpdateResult>("/graph/relationships/bulk-update", payload)
      .then((r) => r.data),
  bulkDeleteRelationships: (payload: {
    filter: {
      type?: string;
      where?: TypedProperty[];
      elementIds?: string[];
      startLabel?: string;
      endLabel?: string;
    };
    confirm: boolean;
    limit?: number;
  }) =>
    api
      .post<BulkDeleteResult>("/graph/relationships/bulk-delete", payload)
      .then((r) => r.data),

  // free-form Cypher
  executeCypher: (payload: {
    cypher: string;
    params?: Record<string, unknown>;
    mode?: "read" | "write";
    timeoutSeconds?: number;
  }) => api.post<CypherResult>("/cypher/execute", payload).then((r) => r.data),

  // analysis meta
  connectivity: () => api.get<ConnectivityReport>("/analysis/connectivity").then((r) => r.data),
  dataTypes: () => api.get<DataTypeReport>("/analysis/data-types").then((r) => r.data),

  // graph algorithms
  pagerank: (topN = 20, weight: "uniform" | "baseCost" = "uniform") =>
    api
      .get<CentralityResult>("/algorithms/pagerank", { params: { topN, weight } })
      .then((r) => r.data),
  betweenness: (topN = 20) =>
    api.get<CentralityResult>("/algorithms/betweenness", { params: { topN } }).then((r) => r.data),
  communities: () => api.get<CommunitiesResult>("/algorithms/communities").then((r) => r.data),
  shortestPath: (
    source: string,
    target: string,
    weight: "baseCost" | "leadTimeDays" = "baseCost"
  ) =>
    api
      .get<ShortestPathResult>("/algorithms/shortest-path", {
        params: { source, target, weight },
      })
      .then((r) => r.data),
  persistCentrality: (topN = 20) =>
    api
      .post<{ updated: number; pagerankTop: CentralityRow[]; betweennessTop: CentralityRow[] }>(
        "/algorithms/persist-centrality",
        null,
        { params: { topN } }
      )
      .then((r) => r.data),

  // CSV upload
  csvTemplates: () =>
    api
      .get<{ nodes: CsvTemplate[]; relationships: CsvTemplate[]; supportedTypes: string[] }>("/csv/templates")
      .then((r) => r.data),
  uploadNodesCsv: (form: FormData) =>
    api
      .post<CsvUploadResult>("/csv/upload/nodes", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data),
  uploadRelationshipsCsv: (form: FormData) =>
    api
      .post<CsvUploadResult>("/csv/upload/relationships", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function asErrorMessage(err: unknown, fallback = "Request failed"): string {
  if (typeof err === "object" && err !== null) {
    // axios error
    const e = err as { response?: { data?: { detail?: string } }; message?: string };
    return e.response?.data?.detail ?? e.message ?? fallback;
  }
  if (typeof err === "string") return err;
  return fallback;
}
