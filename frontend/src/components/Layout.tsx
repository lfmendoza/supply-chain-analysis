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
    title: "Visualization",
    items: [
      { to: "/", label: "Dashboard", Icon: Activity },
      { to: "/topology", label: "Graph Topology", Icon: Network },
      { to: "/algorithms", label: "Graph Algorithms", Icon: Sparkles },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/operations", label: "Operations Lab", Icon: Boxes },
      { to: "/queries", label: "Cypher Explorer", Icon: Code2 },
      { to: "/traceability", label: "Traceability", Icon: Search },
    ],
  },
  {
    title: "Analysis",
    items: [
      { to: "/simulation", label: "Disruption Simulation", Icon: AlertTriangle },
      { to: "/optimization", label: "Optimization", Icon: PlayCircle },
      { to: "/comparison", label: "Before / After", Icon: GitBranch },
    ],
  },
  {
    title: "Quality",
    items: [{ to: "/rubric", label: "Rubric Matrix", Icon: ListChecks }],
  },
];

type Health = { ok: boolean; label: string };

function useNeo4jHealth(): Health {
  const [state, setState] = useState<Health>({ ok: false, label: "Checking..." });
  useEffect(() => {
    const check = () => {
      SupplyChainApi.healthNeo4j()
        .then((r) => setState({ ok: r.status === "ok", label: r.message ?? "Reachable" }))
        .catch(() => setState({ ok: false, label: "Unreachable" }));
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
              <div className="text-sm font-semibold text-slate-900 leading-tight">Supply Chain</div>
              <div className="text-xs text-slate-500 leading-tight">Network Analysis & Optimization</div>
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
            Stack
          </div>
          <div className="mt-1">Neo4j AuraDB · OR-Tools · NetworkX · scikit-learn</div>
          <div className="mt-1">Database 2 academic project</div>
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
      <span>Neo4j {ok ? "online" : "offline"}</span>
      {ok && (
        <span className="ml-1 inline-flex items-center gap-1 text-emerald-600/80">
          <ShieldCheck size={12} />
          AuraDB
        </span>
      )}
    </div>
  );
}
