import type { Comparison } from "../api/client";

type Props = { comparison: Comparison };

const columns = ["Métrica", "Base", "Con disrupción", "Optimizado", "Δ vs disrupción"];

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtDays = (n: number) => `${n.toFixed(1)} d`;
const fmtNum = (n: number) => n.toLocaleString("es");

export default function ComparisonTable({ comparison }: Props) {
  const { base, disrupted, optimized, deltas } = comparison;

  const rows = [
    {
      metric: "Coste total",
      base: fmtCurrency(base.totalCost),
      disrupted: fmtCurrency(disrupted.totalCost),
      optimized: fmtCurrency(optimized.totalCost),
      delta: deltas.costRecovered >= 0 ? `+${fmtCurrency(deltas.costRecovered)} ahorrado` : `-${fmtCurrency(-deltas.costRecovered)}`,
      good: deltas.costRecovered >= 0
    },
    {
      metric: "Plazo medio",
      base: fmtDays(base.avgLeadTime),
      disrupted: fmtDays(disrupted.avgLeadTime),
      optimized: fmtDays(optimized.avgLeadTime),
      delta: `${deltas.leadTimeImprovement >= 0 ? "-" : "+"}${Math.abs(deltas.leadTimeImprovement).toFixed(1)} d`,
      good: deltas.leadTimeImprovement >= 0
    },
    {
      metric: "Cumplimiento %",
      base: fmtPct(base.fulfillmentPct),
      disrupted: fmtPct(disrupted.fulfillmentPct),
      optimized: fmtPct(optimized.fulfillmentPct),
      delta: `${deltas.fulfillmentImprovement >= 0 ? "+" : ""}${deltas.fulfillmentImprovement.toFixed(1)} pp`,
      good: deltas.fulfillmentImprovement >= 0
    },
    {
      metric: "Pedidos afectados",
      base: fmtNum(base.ordersAffected),
      disrupted: fmtNum(disrupted.ordersAffected),
      optimized: fmtNum(optimized.ordersAffected),
      delta: `${deltas.ordersRecovered >= 0 ? "-" : "+"}${Math.abs(deltas.ordersRecovered)} recuperados`,
      good: deltas.ordersRecovered >= 0
    },
    {
      metric: "Ingreso en riesgo",
      base: fmtCurrency(base.revenueAtRisk),
      disrupted: fmtCurrency(disrupted.revenueAtRisk),
      optimized: fmtCurrency(optimized.revenueAtRisk),
      delta: deltas.revenueRecovered >= 0 ? `+${fmtCurrency(deltas.revenueRecovered)} recuperado` : `-${fmtCurrency(-deltas.revenueRecovered)}`,
      good: deltas.revenueRecovered >= 0
    },
    {
      metric: "Riesgo medio",
      base: base.avgRisk.toFixed(3),
      disrupted: disrupted.avgRisk.toFixed(3),
      optimized: optimized.avgRisk.toFixed(3),
      delta: "",
      good: optimized.avgRisk <= disrupted.avgRisk
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.metric}>
              <td className="px-4 py-3 text-sm font-medium text-slate-700">{row.metric}</td>
              <td className="px-4 py-3 text-sm text-slate-700">{row.base}</td>
              <td className="px-4 py-3 text-sm text-rose-600">{row.disrupted}</td>
              <td className="px-4 py-3 text-sm text-emerald-700">{row.optimized}</td>
              <td className={`px-4 py-3 text-sm ${row.good ? "text-emerald-700" : "text-rose-600"}`}>{row.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
