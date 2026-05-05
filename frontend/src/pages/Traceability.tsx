import { useState } from "react";
import { SupplyChainApi } from "../api/client";

export default function Traceability() {
  const [productId, setProductId] = useState("P1");
  const [rmId, setRmId] = useState("RM-A");
  const [traceability, setTraceability] = useState<any[] | null>(null);
  const [alternatives, setAlternatives] = useState<any[] | null>(null);
  const [critical, setCritical] = useState<any[] | null>(null);
  const [unfulfillable, setUnfulfillable] = useState<any | null>(null);
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
      setTraceability(t);
      setAlternatives(a);
      setCritical(c);
      setUnfulfillable(u);
    } catch (e: any) {
      setError(e.message ?? "Query failed");
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Multi-hop Cypher queries</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block text-sm">
            <span className="text-slate-600">Product id</span>
            <input value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 border rounded px-2 py-1 w-32" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Raw material id</span>
            <input value={rmId} onChange={(e) => setRmId(e.target.value)} className="mt-1 border rounded px-2 py-1 w-32" />
          </label>
          <button
            onClick={runQueries}
            className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-500 transition"
          >
            Run all
          </button>
        </div>
        {error && <div className="mt-3 text-rose-600 text-sm">{error}</div>}
      </section>

      {traceability && (
        <Card title={`Q01 · Traceability for ${productId}`}>
          <Table rows={traceability} cols={["supplierId", "supplierName", "rawMaterialId", "rawMaterialName"]} />
        </Card>
      )}

      {alternatives && (
        <Card title={`Q05 · Alternative suppliers for ${rmId}`}>
          <Table rows={alternatives} cols={["supplierId", "supplierName", "unitCost", "leadTimeDays", "riskScore", "rankingScore"]} />
        </Card>
      )}

      {critical && (
        <Card title="Q07 · Critical (single-source) raw materials">
          <Table rows={critical} cols={["rawMaterialId", "rawMaterialName", "activeSuppliers", "atRiskProductIds"]} />
        </Card>
      )}

      {unfulfillable && (
        <Card title="Q09 · Aggregate unfulfillable orders">
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

function Table({ rows, cols }: { rows: any[]; cols: string[] }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-slate-500">No rows.</p>;
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
                  {Array.isArray(r[c]) ? r[c].join(", ") : String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
