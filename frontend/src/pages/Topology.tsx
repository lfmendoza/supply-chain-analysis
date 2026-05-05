import { useEffect, useState } from "react";
import Graph2D from "../components/Graph2D";
import KpiCard from "../components/KpiCard";
import { GraphSummary, SupplyChainApi } from "../api/client";

export default function Topology() {
  const [summary, setSummary] = useState<GraphSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SupplyChainApi.graphSummary()
      .then(setSummary)
      .catch((e) => setError(e.message ?? "Failed to load topology"));
  }, []);

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded p-4">
        Failed to load graph: {error}. Check that the backend is running and Neo4j is reachable.
      </div>
    );
  }
  if (!summary) {
    return <div className="text-slate-500">Loading topology...</div>;
  }

  const cardOrder = ["Supplier", "RawMaterial", "Product", "Warehouse", "Customer", "CustomerOrder", "Route", "DisruptionScenario"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cardOrder.map((label) => (
          <KpiCard key={label} title={label} value={summary.counts[label] ?? 0} />
        ))}
      </div>
      <Graph2D nodes={summary.nodes} edges={summary.edges} height={620} />
      <p className="text-xs text-slate-500">
        Nodes coloured by label. Inactive suppliers and blocked routes are greyed. Click + drag to navigate.
      </p>
    </div>
  );
}
