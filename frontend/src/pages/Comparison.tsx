import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import ComparisonTable from "../components/ComparisonTable";
import { Comparison as ComparisonT, Scenario, SupplyChainApi } from "../api/client";

export default function Comparison() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [comparison, setComparison] = useState<ComparisonT | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SupplyChainApi.scenarios().then((s) => {
      setScenarios(s);
      if (s.length && !scenarioId) setScenarioId(s[0].id);
    });
  }, []);

  const fetchComparison = async (id: string) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const c = await SupplyChainApi.comparison(id);
      setComparison(c);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const fulfilmentPlot = useMemo(() => {
    if (!comparison) return null;
    return (
      <Plot
        data={[
          {
            type: "bar",
            x: ["Base", "Disrupted", "Optimized"],
            y: [
              comparison.base.fulfillmentPct,
              comparison.disrupted.fulfillmentPct,
              comparison.optimized.fulfillmentPct
            ],
            marker: { color: ["#0f172a", "#dc2626", "#16a34a"] }
          }
        ]}
        layout={{
          title: "Fulfillment % by state",
          height: 320,
          yaxis: { range: [0, 100], title: "%" },
          margin: { l: 50, r: 30, t: 50, b: 40 }
        }}
        style={{ width: "100%" }}
        config={{ displayModeBar: false }}
      />
    );
  }, [comparison]);

  const costPlot = useMemo(() => {
    if (!comparison) return null;
    return (
      <Plot
        data={[
          {
            type: "bar",
            x: ["Base", "Disrupted", "Optimized"],
            y: [comparison.base.totalCost, comparison.disrupted.totalCost, comparison.optimized.totalCost],
            marker: { color: ["#0f172a", "#dc2626", "#16a34a"] }
          }
        ]}
        layout={{
          title: "Total cost by state (USD)",
          height: 320,
          margin: { l: 60, r: 30, t: 50, b: 40 }
        }}
        style={{ width: "100%" }}
        config={{ displayModeBar: false }}
      />
    );
  }, [comparison]);

  const usagePlot = useMemo(() => {
    if (!comparison) return null;
    const usage = comparison.optimized.warehouseUsage ?? {};
    const ids = Object.keys(usage);
    return (
      <Plot
        data={[
          {
            type: "bar",
            x: ids,
            y: ids.map((id) => usage[id].used),
            name: "Used"
          },
          {
            type: "bar",
            x: ids,
            y: ids.map((id) => Math.max(0, usage[id].capacity - usage[id].used)),
            name: "Free capacity"
          }
        ]}
        layout={{
          title: "Warehouse usage (optimized)",
          height: 320,
          barmode: "stack",
          margin: { l: 50, r: 30, t: 50, b: 40 }
        }}
        style={{ width: "100%" }}
        config={{ displayModeBar: false }}
      />
    );
  }, [comparison]);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm">
            <span className="text-slate-600 mr-2">Scenario</span>
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">Pick a scenario</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.id} · {s.type}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => fetchComparison(scenarioId)}
            disabled={busy || !scenarioId}
            className="px-4 py-2 rounded bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-60"
          >
            {busy ? "Computing..." : "Compute comparison"}
          </button>
        </div>
        {error && <div className="mt-3 text-rose-600 text-sm">{error}</div>}
      </section>

      {comparison && (
        <>
          <ComparisonTable comparison={comparison} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-2">{fulfilmentPlot}</div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-2">{costPlot}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-2">{usagePlot}</div>
        </>
      )}
    </div>
  );
}
