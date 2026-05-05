import { useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { TopologyEdge, TopologyNode } from "../api/client";

type Props = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  highlight?: { nodeIds?: Set<string>; edgeKeys?: Set<string> };
  height?: number;
};

const labelColors: Record<string, string> = {
  Supplier: "#1d4ed8",
  RawMaterial: "#0ea5e9",
  Product: "#16a34a",
  Warehouse: "#a855f7",
  Customer: "#f59e0b",
  Location: "#6b7280",
  Route: "#94a3b8",
  Carrier: "#475569"
};

export default function Graph2D({ nodes, edges, highlight, height = 600 }: Props) {
  const graphData = useMemo(() => {
    const inactive = new Set(nodes.filter((n) => n.status && n.status !== "active" && n.status !== "open").map((n) => n.id));
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        name: `${n.label} · ${n.name}`,
        label: n.label,
        color: highlight?.nodeIds?.has(n.id) ? "#dc2626" : inactive.has(n.id) ? "#9ca3af" : labelColors[n.label] ?? "#0f172a",
        val: highlight?.nodeIds?.has(n.id) ? 4 : 2
      })),
      links: edges.map((e) => {
        const key = `${e.source}->${e.target}:${e.relType}`;
        return {
          source: e.source,
          target: e.target,
          relType: e.relType,
          color: highlight?.edgeKeys?.has(key)
            ? "#dc2626"
            : e.status && e.status !== "open" && e.status !== "active"
              ? "#cbd5e1"
              : "#94a3b8"
        };
      })
    };
  }, [nodes, edges, highlight]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm" style={{ height }}>
      <ForceGraph2D
        graphData={graphData}
        nodeRelSize={4}
        nodeLabel={(node: any) => node.name}
        linkLabel={(link: any) => link.relType}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={120}
        d3VelocityDecay={0.35}
      />
    </div>
  );
}
