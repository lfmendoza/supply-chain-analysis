import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import {
  ConnectivityReport,
  DataTypeReport,
  GraphSummary,
  SupplyChainApi,
  asErrorMessage,
} from "../api/client";
import PageHeader from "../components/PageHeader";
import { RUBRIC, RUBRIC_TOTAL_POINTS, type RubricCriterion } from "../data/rubric";

type Status = "auto-ok" | "manual" | "warn";

export default function RubricMatrix() {
  const [connectivity, setConnectivity] = useState<ConnectivityReport | null>(null);
  const [dataTypes, setDataTypes] = useState<DataTypeReport | null>(null);
  const [summary, setSummary] = useState<GraphSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      SupplyChainApi.connectivity().then(setConnectivity),
      SupplyChainApi.dataTypes().then(setDataTypes),
      SupplyChainApi.graphSummary().then(setSummary),
    ]).catch((e) => setError(asErrorMessage(e)));
  }, []);

  const statusOf = (c: RubricCriterion): Status => {
    if (c.liveCheck === "connectivity") {
      if (!connectivity) return "manual";
      return connectivity.isConnected ? "auto-ok" : "warn";
    }
    if (c.liveCheck === "dataTypes") {
      if (!dataTypes) return "manual";
      const allEight = Object.values(dataTypes.coverage).every(Boolean);
      return allEight ? "auto-ok" : "warn";
    }
    if (c.liveCheck === "summary") {
      if (!summary) return "manual";
      const totalNodes = Object.values(summary.counts).reduce((a, b) => a + b, 0);
      return totalNodes > 50 ? "auto-ok" : "warn";
    }
    return "manual";
  };

  const totals = useMemo(() => {
    const obtained = RUBRIC.reduce((sum, c) => {
      const s = statusOf(c);
      return s === "auto-ok" ? sum + c.points : sum;
    }, 0);
    const automatic = RUBRIC.filter((c) => c.liveCheck).length;
    const automaticOk = RUBRIC.filter((c) => c.liveCheck && statusOf(c) === "auto-ok").length;
    return { obtained, automatic, automaticOk };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectivity, dataTypes, summary]);

  return (
    <div>
      <PageHeader
        title="Matriz de rúbrica"
        description="22 ítems (110 pts). Auto-OK: comprobado vía API. Resto: usar la pantalla enlazada."
        badge={
          <span className="pill-info">
            {totals.automaticOk}/{totals.automatic} comprobaciones OK · puntos automáticos {totals.obtained}/
            {RUBRIC_TOTAL_POINTS}
          </span>
        }
      />

      {error && (
        <div className="card-pad mb-4 border-rose-200 bg-rose-50 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>#</Th>
              <Th>Cumplimiento</Th>
              <Th>Pts</Th>
              <Th>Evidencia en la app</Th>
              <Th>Estado</Th>
              <Th>Abrir</Th>
            </tr>
          </thead>
          <tbody>
            {RUBRIC.map((c) => {
              const s = statusOf(c);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2 align-top text-slate-500 text-xs">{c.id}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-slate-900">{c.title}</div>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-700 tabular-nums">{c.points}</td>
                  <td className="px-3 py-2 align-top text-slate-600 max-w-[420px]">{c.evidenceText}</td>
                  <td className="px-3 py-2 align-top">
                    {s === "auto-ok" && (
                      <span className="pill-ok">
                        <CheckCircle2 size={11} /> Auto-OK
                      </span>
                    )}
                    {s === "warn" && (
                      <span className="pill-warn">
                        <CheckCircle2 size={11} /> Revisar
                      </span>
                    )}
                    {s === "manual" && (
                      <span className="pill-info">
                        <Circle size={11} /> Manual
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Link
                      to={c.evidencePath}
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline text-xs"
                    >
                      Ir <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Las filas Auto-OK llaman en vivo a{" "}
        <code className="font-mono">/analysis/connectivity</code>,{" "}
        <code className="font-mono">/analysis/data-types</code> y{" "}
        <code className="font-mono">/graph/summary</code>. El resto requiere comprobarlo en la pantalla enlazada.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">
      {children}
    </th>
  );
}
