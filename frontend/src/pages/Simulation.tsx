import { useEffect, useState } from "react";
import { Scenario, SimulationRun, SupplyChainApi } from "../api/client";

const presetScenarios = [
  { type: "supplier_down", label: "Supplier down (S3)", params: { supplierId: "S3" }, description: "Andes Metals SA goes offline" },
  { type: "route_blocked", label: "Route blocked (R-MAIN)", params: { routeId: "R-MAIN" }, description: "Yokohama-Long Beach blocked" },
  { type: "demand_spike", label: "Demand spike P5 +60%", params: { productId: "P5", factor: 1.6 } },
  { type: "inventory_drop", label: "Inventory drop -50%", params: { factor: 0.5 } },
  { type: "cost_increase", label: "Sea cost +35%", params: { mode: "sea", factor: 1.35 } }
];

export default function Simulation() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState(presetScenarios[0]);
  const [lastRun, setLastRun] = useState<SimulationRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => SupplyChainApi.scenarios().then(setScenarios).catch(() => {});

  useEffect(() => {
    refresh();
  }, []);

  const launch = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await SupplyChainApi.runSimulation({
        type: selected.type,
        params: selected.params,
        description: (selected as any).description
      });
      setLastRun(result);
      refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const revert = async (id: string) => {
    setBusy(true);
    try {
      await SupplyChainApi.revertSimulation(id);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">Run a disruption</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={selected.label}
            onChange={(e) => setSelected(presetScenarios.find((p) => p.label === e.target.value)!)}
            className="border rounded px-2 py-1 text-sm"
          >
            {presetScenarios.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={launch}
            disabled={busy}
            className="px-4 py-2 rounded bg-rose-600 text-white text-sm disabled:opacity-60 hover:bg-rose-500"
          >
            {busy ? "Running..." : "Run disruption"}
          </button>
        </div>
        <pre className="mt-3 text-xs bg-slate-50 p-3 rounded">{JSON.stringify(selected.params, null, 2)}</pre>
        {error && <div className="text-rose-600 text-sm mt-2">{error}</div>}
        {lastRun && (
          <div className="mt-4 text-sm">
            <div className="text-emerald-700 font-medium">Created scenario {lastRun.scenarioId}</div>
            <pre className="bg-slate-50 p-3 rounded mt-2 text-xs">{JSON.stringify(lastRun.impacts, null, 2)}</pre>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">Active scenarios</h2>
        {scenarios.length === 0 && <p className="text-sm text-slate-500">No scenarios yet.</p>}
        <ul className="divide-y">
          {scenarios.map((s) => (
            <li key={s.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{s.id} <span className="text-slate-500 text-sm">({s.type})</span></div>
                <div className="text-xs text-slate-500">{s.description}</div>
                <div className="text-xs text-slate-400">created {s.createdAt} · impacts: {s.impactsCount}</div>
              </div>
              <button
                onClick={() => revert(s.id)}
                disabled={busy}
                className="px-3 py-1 rounded bg-slate-700 text-white text-xs hover:bg-slate-600 disabled:opacity-60"
              >
                Revert
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
