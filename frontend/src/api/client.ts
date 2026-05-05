import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE ?? "/api";

export const api = axios.create({ baseURL, timeout: 30000 });

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

export const SupplyChainApi = {
  health: () => api.get<{ status: string }>("/health").then((r) => r.data),
  healthNeo4j: () => api.get<{ status: string; message: string }>("/health/neo4j").then((r) => r.data),
  graphSummary: () => api.get<GraphSummary>("/graph/summary").then((r) => r.data),
  productTraceability: (id: string) => api.get(`/products/${id}/traceability`).then((r) => r.data),
  supplierImpact: (id: string) => api.get(`/suppliers/${id}/impact`).then((r) => r.data),
  alternativeSuppliers: (rmId: string) => api.get(`/materials/${rmId}/alternatives`).then((r) => r.data),
  criticalDependencies: () => api.get(`/analysis/critical-dependencies`).then((r) => r.data),
  unfulfillableOrders: () => api.get(`/orders/unfulfillable`).then((r) => r.data),
  scenarios: () => api.get<Scenario[]>(`/simulation/scenarios`).then((r) => r.data),
  scenarioImpacts: (id: string) => api.get(`/simulation/scenarios/${id}/impacts`).then((r) => r.data),
  runSimulation: (payload: { type: string; params: Record<string, unknown>; description?: string }) =>
    api.post<SimulationRun>("/simulation/run", payload).then((r) => r.data),
  revertSimulation: (id: string) => api.post(`/simulation/revert/${id}`).then((r) => r.data),
  runOptimization: (payload: { scenarioId?: string | null; weights?: Record<string, number>; timeLimitSeconds?: number }) =>
    api.post<OptimizationResult>("/optimization/run", payload).then((r) => r.data),
  comparison: (scenarioId: string) =>
    api.get<Comparison>(`/optimization/scenarios/${scenarioId}/comparison`).then((r) => r.data),
  refreshSupplierRisk: () => api.get(`/ml/supplier-risk`).then((r) => r.data),
  trainSupplierRisk: () => api.post(`/ml/supplier-risk/train`).then((r) => r.data)
};
