import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Brain,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  GitBranch,
  Layers,
  ListChecks,
  Network,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
  Zap,
} from "lucide-react";
import {
  ConnectivityReport,
  DataTypeReport,
  GraphSummary,
  Scenario,
  SupplyChainApi,
  asErrorMessage,
} from "../api/client";
import PageHeader from "../components/PageHeader";

type LoadState<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: string };

function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loader()
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", error: asErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

const DATATYPE_ORDER = ["String", "Integer", "Float", "Boolean", "Date", "DateTime", "List", "Point"] as const;

export default function Dashboard() {
  const summary = useLoad(() => SupplyChainApi.graphSummary());
  const connectivity = useLoad(() => SupplyChainApi.connectivity());
  const dataTypes = useLoad(() => SupplyChainApi.dataTypes());
  const scenarios = useLoad(() => SupplyChainApi.scenarios());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de cadena de suministro"
        description="Resumen del grafo, cobertura de tipos de datos y accesos rápidos."
        badge={
          connectivity.status === "ok" && connectivity.data.isConnected ? (
            <span className="pill-ok">
              <CheckCircle2 size={12} /> Grafo conexo
            </span>
          ) : connectivity.status === "ok" ? (
            <span className="pill-warn">
              <AlertTriangle size={12} /> {connectivity.data.components} componentes
            </span>
          ) : null
        }
      />

      <SystemFlowCard />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigKpi
          icon={<Layers size={18} />}
          label="Nodos totales"
          value={
            summary.status === "ok"
              ? Object.values(summary.data.counts).reduce((a, b) => a + b, 0).toLocaleString("es")
              : "—"
          }
        />
        <BigKpi
          icon={<Network size={18} />}
          label="Relaciones"
          value={summary.status === "ok" ? summary.data.edges.length.toLocaleString("es") : "—"}
        />
        <BigKpi
          icon={<Workflow size={18} />}
          label="Componentes"
          value={connectivity.status === "ok" ? String(connectivity.data.components) : "—"}
          hint={
            connectivity.status === "ok"
              ? `El mayor cubre el ${(connectivity.data.largestComponentRatio * 100).toFixed(0)}% de los nodos`
              : undefined
          }
        />
        <BigKpi
          icon={<AlertTriangle size={18} />}
          label="Escenarios activos"
          value={scenarios.status === "ok" ? String(scenarios.data.length) : "—"}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <NodeCountsCard summary={summary} />
        <DataTypesCard dataTypes={dataTypes} />
        <ShortcutsCard />
      </div>

      <ConnectivityCard connectivity={connectivity} />
    </div>
  );
}

function BigKpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card-pad">
      <div className="flex items-center justify-between text-slate-500">
        <span className="label">{label}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function NodeCountsCard({ summary }: { summary: LoadState<GraphSummary> }) {
  return (
    <div className="card-pad">
      <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Boxes size={14} /> Conteos por etiqueta
      </h2>
      {summary.status === "loading" && <p className="mt-3 text-sm text-slate-500">Cargando…</p>}
      {summary.status === "error" && <p className="mt-3 text-sm text-rose-600">{summary.error}</p>}
      {summary.status === "ok" && (
        <ul className="mt-3 space-y-1.5">
          {Object.entries(summary.data.counts)
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => (
              <li key={label} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{label}</span>
                <span className="tabular-nums font-medium text-slate-900">{count.toLocaleString("es")}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function DataTypesCard({ dataTypes }: { dataTypes: LoadState<DataTypeReport> }) {
  return (
    <div className="card-pad">
      <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Database size={14} /> Cobertura de tipos Neo4j
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Tipos de propiedad según el esquema de Neo4j (`db.schema.*`).
      </p>
      {dataTypes.status === "ok" && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {DATATYPE_ORDER.map((t) => {
            const present = dataTypes.data.coverage[t];
            return (
              <div
                key={t}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
                  present
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {present ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                <span className="font-medium">{t}</span>
              </div>
            );
          })}
        </div>
      )}
      {dataTypes.status === "error" && (
        <p className="mt-3 text-sm text-rose-600">{dataTypes.error}</p>
      )}
    </div>
  );
}

function ShortcutsCard() {
  const items = [
    { to: "/topology", icon: <Network size={14} />, title: "Explorar topología", desc: "Grafo interactivo con Cytoscape." },
    { to: "/operations", icon: <Boxes size={14} />, title: "Laboratorio", desc: "CRUD de nodos y relaciones e importación CSV." },
    { to: "/queries", icon: <Sparkles size={14} />, title: "Explorador Cypher", desc: "15 consultas predefinidas y editor libre." },
    { to: "/algorithms", icon: <TrendingUp size={14} />, title: "Ejecutar algoritmos", desc: "PageRank, betweenness, comunidades, Dijkstra." },
    { to: "/rubric", icon: <ListChecks size={14} />, title: "Matriz de rúbrica", desc: "Lista con enlaces dentro de la app." },
  ];
  return (
    <div className="card-pad">
      <h2 className="text-sm font-semibold text-slate-700">Accesos rápidos</h2>
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li key={it.to}>
            <Link
              to={it.to}
              className="flex items-start gap-2.5 rounded-md p-2 hover:bg-slate-50 transition"
            >
              <span className="mt-0.5 text-brand-600">{it.icon}</span>
              <div>
                <div className="text-sm font-medium text-slate-800">{it.title}</div>
                <div className="text-xs text-slate-500">{it.desc}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SystemFlowCard() {
  const stages = [
    {
      icon: <Database size={16} />,
      title: "1 · Modelar",
      detail: "12 etiquetas, 18 tipos de relaciones, 8 tipos nativos en Neo4j AuraDB.",
      to: "/topology",
    },
    {
      icon: <Boxes size={16} />,
      title: "2 · Operar",
      detail: "CRUD individual y masivo, importación CSV, ejecución Cypher.",
      to: "/operations",
    },
    {
      icon: <Brain size={16} />,
      title: "3 · Analizar",
      detail: "PageRank, betweenness, Louvain, Dijkstra y ML de riesgo.",
      to: "/algorithms",
    },
    {
      icon: <Zap size={16} />,
      title: "4 · Simular",
      detail: "Disrupciones reversibles (proveedor caído, ruta bloqueada, demanda spike).",
      to: "/simulation",
    },
    {
      icon: <Target size={16} />,
      title: "5 · Optimizar",
      detail: "Reasignación pedido→bodega con OR-Tools (CP-SAT) multi-criterio.",
      to: "/optimization",
    },
    {
      icon: <Eye size={16} />,
      title: "6 · Comparar",
      detail: "Métricas base vs. disruptivo vs. optimizado lado a lado.",
      to: "/comparison",
    },
  ];

  return (
    <section className="card-pad">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Workflow size={14} /> Flujo del sistema
        </h2>
        <Link
          to="/rubric"
          className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
        >
          Ver matriz de rúbrica <ArrowRight size={11} />
        </Link>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Seis etapas: el grafo se modela en Neo4j, se opera con CRUD y CSV, se
        analiza con algoritmos de grafos y ML, se exponen disrupciones, se
        optimiza la respuesta combinatoriamente y se compara contra el estado
        original.
      </p>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {stages.map((s, i) => (
          <li key={s.to} className="relative">
            <Link
              to={s.to}
              className="block rounded-md border border-slate-200 bg-white px-3 py-2.5 hover:border-brand-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-2 text-brand-600">
                {s.icon}
                <span className="text-xs font-semibold">{s.title}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-600 leading-snug">
                {s.detail}
              </div>
            </Link>
            {i < stages.length - 1 && (
              <span className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-slate-300">
                <GitBranch size={12} className="rotate-90" />
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Cpu size={11} /> Tecnologías:
        </span>
        <span className="pill-info">Neo4j AuraDB</span>
        <span className="pill-info">FastAPI</span>
        <span className="pill-info">NetworkX</span>
        <span className="pill-info">scikit-learn</span>
        <span className="pill-info">OR-Tools (CP-SAT)</span>
        <span className="pill-info">React + Vite</span>
        <span className="pill-info">Cytoscape.js</span>
      </div>
    </section>
  );
}

function ConnectivityCard({ connectivity }: { connectivity: LoadState<ConnectivityReport> }) {
  return (
    <div className="card-pad">
      <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Workflow size={14} /> Informe de conectividad
      </h2>
      {connectivity.status === "loading" && (
        <p className="mt-2 text-sm text-slate-500">Calculando componentes débilmente conexas…</p>
      )}
      {connectivity.status === "error" && (
        <p className="mt-2 text-sm text-rose-600">{connectivity.error}</p>
      )}
      {connectivity.status === "ok" && (() => {
        const isolatedNodes = connectivity.data.isolatedNodes ?? [];
        const componentSummary = connectivity.data.componentSummary ?? [];
        return (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <ul className="space-y-1 text-sm text-slate-700">
              <li>
                <strong>{connectivity.data.nodes}</strong> nodos /{" "}
                <strong>{connectivity.data.relationships}</strong> relaciones
              </li>
              <li>
                <strong>{connectivity.data.components}</strong> componentes conexas
              </li>
              <li>
                Componente mayor: <strong>{connectivity.data.largestComponentSize}</strong> nodos (
                {(connectivity.data.largestComponentRatio * 100).toFixed(1)}%)
              </li>
              <li>
                Nodos aislados: <strong>{isolatedNodes.length}</strong>
              </li>
            </ul>
            {componentSummary.length > 1 && (
              <ul className="text-xs text-slate-600 space-y-1">
                {componentSummary.map((c, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <span>Componente {i + 1}</span>
                    <span className="tabular-nums">{c.size} nodos</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}
    </div>
  );
}
