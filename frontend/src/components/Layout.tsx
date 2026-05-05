import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Code2,
  Database,
  GitBranch,
  Hexagon,
  ListChecks,
  Network,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { SupplyChainApi } from "../api/client";

type Section = {
  title: string;
  items: { to: string; label: string; Icon: LucideIcon }[];
};

const sections: Section[] = [
  {
    title: "Visualización",
    items: [
      { to: "/", label: "Panel", Icon: Activity },
      { to: "/topology", label: "Topología", Icon: Network },
      { to: "/algorithms", label: "Algoritmos", Icon: Sparkles },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { to: "/operations", label: "Laboratorio", Icon: Boxes },
      { to: "/queries", label: "Cypher", Icon: Code2 },
      { to: "/traceability", label: "Trazabilidad", Icon: Search },
    ],
  },
  {
    title: "Análisis",
    items: [
      { to: "/simulation", label: "Simulación", Icon: AlertTriangle },
      { to: "/optimization", label: "Optimización", Icon: PlayCircle },
      { to: "/comparison", label: "Antes / Después", Icon: GitBranch },
    ],
  },
  {
    title: "Calidad",
    items: [{ to: "/rubric", label: "Rúbrica", Icon: ListChecks }],
  },
];

type Health = { ok: boolean; label: string };

function useNeo4jHealth(): Health {
  const [state, setState] = useState<Health>({ ok: false, label: "Comprobando…" });
  useEffect(() => {
    const check = () => {
      SupplyChainApi.healthNeo4j()
        .then((r) => setState({ ok: r.status === "ok", label: r.message ?? "Accesible" }))
        .catch(() => setState({ ok: false, label: "No accesible" }));
    };
    check();
    const t = window.setInterval(check, 30000);
    return () => window.clearInterval(t);
  }, []);
  return state;
}

export default function Layout() {
  const health = useNeo4jHealth();
  return (
    <div className="min-h-full grid grid-cols-[260px_1fr] bg-slate-50">
      <aside className="border-r border-slate-200 bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-brand-600 p-2 text-white">
              <Hexagon size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 leading-tight">Cadena de suministro</div>
              <div className="text-xs text-slate-500 leading-tight">Análisis y optimización de red</div>
            </div>
          </div>
          <HealthBadge ok={health.ok} label={health.label} />
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {sections.map((section) => (
            <div key={section.title} className="px-3 mb-4">
              <div className="px-2 mb-1 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
                          isActive
                            ? "bg-brand-50 text-brand-600 font-medium"
                            : "text-slate-700 hover:bg-slate-100"
                        }`
                      }
                    >
                      <item.Icon size={16} className="shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-slate-200 text-[11px] text-slate-500 leading-snug">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Workflow size={13} />
            Tecnología
          </div>
          <div className="mt-1">Neo4j AuraDB · OR-Tools · NetworkX · scikit-learn</div>
          <div className="mt-1">Bases de datos 2 · grafo de cadena de suministro</div>
        </div>
      </aside>
      <main className="overflow-y-auto">
        <div className="max-w-[1400px] mx-auto w-full px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function HealthBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
      title={label}
    >
      {ok ? (
        <CheckCircle2 size={13} />
      ) : (
        <Database size={13} />
      )}
      <span>Neo4j {ok ? "en línea" : "fuera de línea"}</span>
      {ok && (
        <span className="ml-1 inline-flex items-center gap-1 text-emerald-600/80">
          <ShieldCheck size={12} />
          AuraDB
        </span>
      )}
    </div>
  );
}
