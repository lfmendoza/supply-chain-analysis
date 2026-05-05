import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { SupplyChainApi } from "../api/client";

export default function Traceability() {
  const [productId, setProductId] = useState("P1");
  const [rmId, setRmId] = useState("RM-A");
  const [traceability, setTraceability] = useState<Record<string, unknown>[] | null>(null);
  const [alternatives, setAlternatives] = useState<Record<string, unknown>[] | null>(null);
  const [critical, setCritical] = useState<Record<string, unknown>[] | null>(null);
  const [unfulfillable, setUnfulfillable] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const runQueries = async () => {
    setError(null);
    try {
      const [t, a, c, u] = await Promise.all([
        SupplyChainApi.productTraceability(productId),
        SupplyChainApi.alternativeSuppliers(rmId),
        SupplyChainApi.criticalDependencies(),
        SupplyChainApi.unfulfillableOrders()
      ]);
      setTraceability(t as Record<string, unknown>[]);
      setAlternatives(a as Record<string, unknown>[]);
      setCritical(c as Record<string, unknown>[]);
      setUnfulfillable(u);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Falló la consulta");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trazabilidad"
        description="Consultas multi-salto desde la API de trazabilidad y alternativas."
      />
      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Consultas Cypher multi-salto (vía API)</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block text-sm">
            <span className="text-slate-600">Id producto</span>
            <input value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 border rounded px-2 py-1 w-32" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Id materia prima</span>
            <input value={rmId} onChange={(e) => setRmId(e.target.value)} className="mt-1 border rounded px-2 py-1 w-32" />
          </label>
          <button
            onClick={runQueries}
            className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-500 transition"
          >
            Ejecutar todas
          </button>
        </div>
        {error && <div className="mt-3 text-rose-600 text-sm">{error}</div>}
      </section>

      {traceability && (
        <Card title={`Q01 · Trazabilidad de ${productId}`}>
          <Table rows={traceability} cols={["supplierId", "supplierName", "rawMaterialId", "rawMaterialName"]} />
        </Card>
      )}

      {alternatives && (
        <Card title={`Q05 · Proveedores alternativos para ${rmId}`}>
          <Table rows={alternatives} cols={["supplierId", "supplierName", "unitCost", "leadTimeDays", "riskScore", "rankingScore"]} />
        </Card>
      )}

      {critical && (
        <Card title="Q07 · Materias críticas (un solo proveedor)">
          <Table rows={critical} cols={["rawMaterialId", "rawMaterialName", "activeSuppliers", "atRiskProductIds"]} />
        </Card>
      )}

      {unfulfillable !== null && (
        <Card title="Q09 · Pedidos no cumplibles (agregado)">
          <pre className="text-sm bg-slate-50 p-3 rounded">{JSON.stringify(unfulfillable, null, 2)}</pre>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Table({ rows, cols }: { rows: Record<string, unknown>[]; cols: string[] }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-slate-500">Sin filas.</p>;
  }
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-2 py-1 text-left font-medium text-slate-600">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {cols.map((c) => (
                <td key={c} className="px-2 py-1 text-slate-700">
                  {Array.isArray(r[c]) ? (r[c] as unknown[]).join(", ") : String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
