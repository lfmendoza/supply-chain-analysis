import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { OptimizationResult, Scenario, SupplyChainApi } from "../api/client";

export default function Optimization() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SupplyChainApi.scenarios().then((s) => {
      setScenarios(s);
      if (s.length && !scenarioId) setScenarioId(s[0].id);
    });
  }, []);

  const runOpt = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await SupplyChainApi.runOptimization({ scenarioId: scenarioId || null });
      setResult(res);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail ?? err.message ?? "Fallo al resolver");
    } finally {
      setBusy(false);
    }
  };

  const refreshRisk = async () => {
    setBusy(true);
    try {
      await SupplyChainApi.refreshSupplierRisk();
    } catch {
      /* el endpoint puede no estar listo hasta entrenar el modelo */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Optimización"
        description="Asignación pedido–almacén con OR-Tools (CP-SAT) bajo el escenario seleccionado."
      />
      <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">Resolver asignación pedido–almacén</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm">
            <span className="text-slate-600 mr-2">Escenario</span>
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">(línea base / sin escenario)</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.id} · {s.type}</option>
              ))}
            </select>
          </label>
          <button onClick={runOpt} disabled={busy} className="px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-60">
            {busy ? "Resolviendo…" : "Ejecutar optimización"}
          </button>
          <button onClick={refreshRisk} disabled={busy} className="px-4 py-2 rounded bg-slate-700 text-white text-sm hover:bg-slate-600 disabled:opacity-60">
            Recalcular riesgo proveedor (ML)
          </button>
        </div>
        {error && <div className="mt-3 text-rose-600 text-sm">{error}</div>}
      </section>

      {result && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Estado del solver" value={result.status} />
            <Stat label="Objetivo" value={result.objectiveValue.toLocaleString("es")} />
            <Stat label="Tiempo" value={`${result.runtimeMs} ms`} />
            <Stat label="Asignados / sin cubrir" value={`${result.assignments.length} / ${result.unfulfilledOrderIds.length}`} />
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-slate-700 mb-3">Asignaciones</h3>
            <div className="overflow-auto max-h-[420px]">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {["Pedido", "Almacén", "Coste", "Plazo", "Riesgo"].map((h) => (
                      <th key={h} className="px-2 py-1 text-left font-medium text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.assignments.map((a) => (
                    <tr key={a.orderId} className="border-t">
                      <td className="px-2 py-1">{a.orderId}</td>
                      <td className="px-2 py-1">{a.warehouseId}</td>
                      <td className="px-2 py-1">${a.cost.toFixed(2)}</td>
                      <td className="px-2 py-1">{a.leadTime} d</td>
                      <td className="px-2 py-1">{a.risk.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-slate-700 mb-3">Pedidos sin cubrir</h3>
            <p className="text-sm text-slate-700">
              {result.unfulfilledOrderIds.length === 0
                ? "Todos los pedidos tienen asignación"
                : result.unfulfilledOrderIds.join(", ")}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
      <div className="text-xs uppercase text-slate-500 tracking-wide">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-700">{value}</div>
    </div>
  );
}
