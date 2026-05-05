import type cytoscape from "cytoscape";

/**
 * Color scheme for the supply chain graph. Kept in one place so the
 * Topology, Algorithms and Operations pages all paint nodes the same way.
 */
export const LABEL_COLORS: Record<string, string> = {
  Supplier: "#1d4ed8",
  RawMaterial: "#0ea5e9",
  Product: "#16a34a",
  Warehouse: "#a855f7",
  Customer: "#f59e0b",
  Location: "#64748b",
  Route: "#475569",
  Carrier: "#0f172a",
  Inventory: "#22c55e",
  CustomerOrder: "#f97316",
  PurchaseOrder: "#ea580c",
  Shipment: "#0d9488",
  DisruptionScenario: "#b91c1c",
  OptimizedAssignment: "#15803d",
};

export const ALL_LABELS = Object.keys(LABEL_COLORS);

const labelClassRules: cytoscape.StylesheetStyle[] = Object.entries(LABEL_COLORS).map(
  ([label, color]) => ({
    selector: `.label-${label}`,
    style: { "background-color": color },
  })
);

export const cytoscapeStylesheet: cytoscape.StylesheetStyle[] = [
  {
    selector: "node",
    style: {
      "background-color": "#94a3b8",
      label: "data(displayLabel)",
      "font-size": 9,
      "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 4,
      color: "#1f2937",
      width: 18,
      height: 18,
      "border-width": 1,
      "border-color": "#ffffff",
    },
  },
  ...labelClassRules,
  {
    selector: "node.inactive",
    style: {
      "background-color": "#cbd5e1",
      "border-color": "#94a3b8",
      "border-width": 2,
      opacity: 0.55,
    },
  },
  {
    selector: "node.faded",
    style: { opacity: 0.18, "text-opacity": 0.18 },
  },
  {
    selector: "node.impact",
    style: {
      "background-color": "#dc2626",
      "border-color": "#7f1d1d",
      "border-width": 3,
      width: 26,
      height: 26,
    },
  },
  {
    selector: "node.optimized",
    style: {
      "border-color": "#15803d",
      "border-width": 4,
    },
  },
  {
    selector: "node.algo-top",
    style: {
      "border-color": "#f59e0b",
      "border-width": 4,
      width: 24,
      height: 24,
    },
  },
  {
    selector: "node.path-node",
    style: {
      "border-color": "#0ea5e9",
      "border-width": 4,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-color": "#2563eb",
      "border-width": 4,
    },
  },
  {
    selector: "edge",
    style: {
      "line-color": "#cbd5e1",
      width: 1,
      "target-arrow-color": "#cbd5e1",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.9,
      "curve-style": "bezier",
      opacity: 0.65,
      label: "",
    },
  },
  {
    selector: "edge.show-label",
    style: {
      label: "data(relType)",
      "font-size": 8,
      "text-rotation": "autorotate",
      "text-background-color": "#fff",
      "text-background-opacity": 0.85,
      "text-background-padding": "1px",
      color: "#475569",
    },
  },
  {
    selector: "edge.blocked",
    style: { "line-color": "#fca5a5", "line-style": "dashed", "target-arrow-color": "#fca5a5" },
  },
  {
    selector: "edge.faded",
    style: { opacity: 0.05 },
  },
  {
    selector: "edge.impact-edge",
    style: {
      "line-color": "#dc2626",
      width: 3,
      "target-arrow-color": "#dc2626",
    },
  },
  {
    selector: "edge.path-edge",
    style: {
      "line-color": "#0ea5e9",
      width: 3.5,
      "target-arrow-color": "#0ea5e9",
    },
  },
  {
    selector: "edge:selected",
    style: { "line-color": "#2563eb", width: 3, "target-arrow-color": "#2563eb" },
  },
];

export const fcoseLayoutOptions: object = {
  name: "fcose",
  quality: "default",
  animate: false,
  randomize: true,
  fit: true,
  padding: 30,
  idealEdgeLength: 90,
  nodeRepulsion: 4500,
  nodeSeparation: 90,
  edgeElasticity: 0.45,
  gravity: 0.25,
};
