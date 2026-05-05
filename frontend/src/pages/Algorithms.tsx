import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity,
  Award,
  Compass,
  Network,
  Save,
  Sparkles,
  Workflow,
} from "lucide-react";
import {
  CentralityResult,
  CommunitiesResult,
  GraphSummary,
  ShortestPathResult,
  SupplyChainApi,
  asErrorMessage,
} from "../api/client";
import PageHeader from "../components/PageHeader";
import GraphCytoscape, {
  type Highlights,
} from "../components/graph/GraphCytoscape";
import { LABEL_COLORS } from "../components/graph/graphStyles";

type Tab = "pagerank" | "betweenness" | "communities" | "shortest";

const TABS: { id: Tab; label: string; Icon: typeof Activity; description: string }[] = [
  {
    id: "pagerank",
    label: "PageRank",
    Icon: Activity,
    description: "Identifica focos cuya disrupción más se propaga.",
  },
  {
    id: "betweenness",
    label: "Intermediación",
    Icon: Workflow,
    description: "Cuellos de botella en los caminos más cortos.",
  },
  {
    id: "communities",
    label: "Comunidades (Louvain)",
    Icon: Award,
    description: "Agrupaciones naturales en la cadena.",
  },
  {
    id: "shortest",
    label: "Camino mínimo (Dijkstra)",
    Icon: Compass,
    description: "Ruta física de menor coste o plazo.",
  },
];

export default function Algorithms() {
  const [tab, setTab] = useState<Tab>("pagerank");
  const [summary, setSummary] = useState<GraphSummary | null>(null);

  const [pr, setPr] = useState<CentralityResult | null>(null);
  const [bt, setBt] = useState<CentralityResult | null>(null);
  const [comm, setComm] = useState<CommunitiesResult | null>(null);
  const [sp, setSp] = useState<ShortestPathResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Shortest path inputs
  const [spSource, setSpSource] = useState("S1");
  const [spTarget, setSpTarget] = useState("LOC4");
  const [spWeight, setSpWeight] = useState<"baseCost" | "leadTimeDays">("baseCost");

  useEffect(() => {
    SupplyChainApi.graphSummary()
      .then(setSummary)
      .catch((e) => toast.error(asErrorMessage(e)));
  }, []);

  const runPageRank = async () => {
    setBusy(true);
    try {
      setPr(await SupplyChainApi.pagerank(20));
      toast.success("PageRank calculado");
    } catch (e) {
      toast.error(asErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runBetweenness = async () => {
    setBusy(true);
    try {
      setBt(await SupplyChainApi.betweenness(20));
      toast.success("Intermediación calculada");
    } catch (e) {
      toast.error(asErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runCommunities = async () => {
    setBusy(true);
    try {
      setComm(await SupplyChainApi.communities());
      toast.success("Comunidades Louvain calculadas");
    } catch (e) {
      toast.error(asErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runShortest = async () => {
    setBusy(true);
    try {
      const r = await SupplyChainApi.shortestPath(spSource.trim(), spTarget.trim(), spWeight);
      setSp(r);
      if (r.found) toast.success(`Camino encontrado · ${r.hops} saltos · coste ${r.totalWeight ?? "?"}`);
      else toast(`Sin camino: ${r.reason ?? "?"}`, { icon: "ℹ" });
    } catch (e) {
      toast.error(asErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const persist = async () => {
    setBusy(true);
    try {
      const r = await SupplyChainApi.persistCentrality(20);
      toast.success(`Centralidad guardada en ${r.updated} nodos`);
    } catch (e) {
      toast.error(asErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const highlights: Highlights = useMemo(() => {
    if (tab === "pagerank" && pr)
      return { algoTopNodes: new Set(pr.results.slice(0, 10).map((r) => r.id)) };
    if (tab === "betweenness" && bt)
      return { algoTopNodes: new Set(bt.results.slice(0, 10).map((r) => r.id)) };
    if (tab === "shortest" && sp?.found)
      return {
        pathNodes: new Set(sp.path),
        pathEdgeKeys: new Set(sp.edgeKeys ?? []),
      };
    return {};
  }, [tab, pr, bt, sp]);

  return (
    <div>
      <PageHeader
        title="Algoritmos sobre el grafo"
        description="PageRank, centralidad de intermediación, comunidades Louvain y Dijkstra en NetworkX (Aura Free no incluye GDS). Los nodos destacados se resaltan en el grafo."
        actions={
          <button onClick={persist} className="btn-secondary text-xs" disabled={busy}>
            <Save size={13} /> Guardar centralidad
          </button>
        }
      />

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              tab === t.id
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.Icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        <div className="space-y-3">
          {tab === "pagerank" && (
            <CentralityCard
              title="PageRank · nodos principales"
              subtitle="Focos cuya disrupción más se propaga."
              result={pr}
              onRun={runPageRank}
              busy={busy}
            />
          )}
          {tab === "betweenness" && (
            <CentralityCard
              title="Intermediación · nodos principales"
              subtitle="Cuellos de botella en los caminos más cortos."
              result={bt}
              onRun={runBetweenness}
              busy={busy}
            />
          )}
          {tab === "communities" && (
            <CommunitiesCard result={comm} onRun={runCommunities} busy={busy} />
          )}
          {tab === "shortest" && (
            <ShortestCard
              result={sp}
              source={spSource}
              target={spTarget}
              weight={spWeight}
              onSource={setSpSource}
              onTarget={setSpTarget}
              onWeight={setSpWeight}
              onRun={runShortest}
              busy={busy}
            />
          )}
        </div>

        <div>
          {summary ? (
            <GraphCytoscape
              nodes={summary.nodes}
              edges={summary.edges}
              highlights={highlights}
              height={620}
            />
          ) : (
            <div className="card flex items-center justify-center text-sm text-slate-500" style={{ height: 620 }}>
              Cargando grafo…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CentralityCard({
  title,
  subtitle,
  result,
  onRun,
  busy,
}: {
  title: string;
  subtitle: string;
  result: CentralityResult | null;
  onRun: () => void;
  busy: boolean;
}) {
  return (
    <div className="card-pad">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <button onClick={onRun} disabled={busy} className="btn-primary text-xs">
          <Sparkles size={13} /> {busy ? "Calculando…" : "Ejecutar"}
        </button>
      </div>
      {result ? (
        <>
          <p className="text-[11px] text-slate-500 italic mb-2">{result.interpretation}</p>
          <ol className="space-y-0.5">
            {result.results.slice(0, 12).map((r, i) => (
              <li
                key={r.id}
                className="flex items-center gap-2 text-sm border-b border-slate-100 last:border-b-0 py-1"
              >
                <span className="w-5 text-slate-400 tabular-nums text-xs">{i + 1}</span>
                <span
                  className="inline-block rounded-full"
                  style={{
                    backgroundColor: LABEL_COLORS[r.label] ?? "#94a3b8",
                    width: 9,
                    height: 9,
                  }}
                />
                <span className="font-medium text-slate-800 truncate flex-1" title={r.name ?? r.id}>
                  {r.name ?? r.id}
                  <span className="ml-1 text-[11px] text-slate-400">{r.label}</span>
                </span>
                <span className="text-xs tabular-nums text-slate-700">{r.score.toFixed(4)}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="text-sm text-slate-500">Pulsa Ejecutar para calcular.</div>
      )}
    </div>
  );
}

function CommunitiesCard({
  result,
  onRun,
  busy,
}: {
  result: CommunitiesResult | null;
  onRun: () => void;
  busy: boolean;
}) {
  return (
    <div className="card-pad">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Comunidades Louvain</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Optimización greedy de modularidad sobre el núcleo del grafo sin dirección.
          </p>
        </div>
        <button onClick={onRun} disabled={busy} className="btn-primary text-xs">
          <Network size={13} /> {busy ? "Calculando…" : "Ejecutar"}
        </button>
      </div>
      {result ? (
        <>
          <p className="text-[11px] text-slate-500 italic mb-2">{result.interpretation}</p>
          <div className="text-xs mb-2 flex gap-2 flex-wrap">
            <span className="pill-info">Modularidad: {result.modularity.toFixed(3)}</span>
            <span className="pill-info">Comunidades: {result.totalCommunities}</span>
          </div>
          <ul className="space-y-2">
            {result.communities.map((c) => (
              <li key={c.communityId} className="border border-slate-200 rounded-md p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">
                    Community #{c.communityId}
                  </span>
                  <span className="pill-info">{c.size} nodos</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(c.byLabel).map(([label, count]) => (
                    <span key={label} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                      <span
                        className="inline-block rounded-full mr-1"
                        style={{
                          backgroundColor: LABEL_COLORS[label] ?? "#94a3b8",
                          width: 8,
                          height: 8,
                        }}
                      />
                      {label}: {count}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="text-sm text-slate-500">Pulsa Ejecutar para detectar comunidades.</div>
      )}
    </div>
  );
}

function edgeWeightLabel(w: "baseCost" | "leadTimeDays"): string {
  if (w === "baseCost") return "Coste base (USD)";
  return "Días de plazo";
}

function ShortestCard({
  result,
  source,
  target,
  weight,
  onSource,
  onTarget,
  onWeight,
  onRun,
  busy,
}: {
  result: ShortestPathResult | null;
  source: string;
  target: string;
  weight: "baseCost" | "leadTimeDays";
  onSource: (v: string) => void;
  onTarget: (v: string) => void;
  onWeight: (v: "baseCost" | "leadTimeDays") => void;
  onRun: () => void;
  busy: boolean;
}) {
  return (
    <div className="card-pad">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Camino mínimo Dijkstra</h3>
      <p className="text-xs text-slate-500 mb-3">
        Calculado como no dirigido sobre el núcleo de la cadena. Prueba{" "}
        <code className="font-mono text-[11px]">S1 → LOC4</code> o{" "}
        <code className="font-mono text-[11px]">LOC1 → LOC11</code>.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="Id origen">
          <input value={source} onChange={(e) => onSource(e.target.value)} className="input w-full" />
        </Field>
        <Field label="Id destino">
          <input value={target} onChange={(e) => onTarget(e.target.value)} className="input w-full" />
        </Field>
        <Field label="Peso de arista">
          <select
            value={weight}
            onChange={(e) => onWeight(e.target.value as "baseCost" | "leadTimeDays")}
            className="input w-full"
          >
            <option value="baseCost">Coste base (propiedad baseCost, USD)</option>
            <option value="leadTimeDays">Días de plazo (propiedad leadTimeDays)</option>
          </select>
        </Field>
        <div className="self-end">
          <button onClick={onRun} disabled={busy} className="btn-primary text-xs w-full">
            <Compass size={13} /> {busy ? "Calculando…" : "Buscar camino"}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-2 text-sm">
          {result.found ? (
            <>
              <div className="flex flex-wrap gap-2 mb-2 text-xs">
                <span className="pill-info">Saltos: {result.hops}</span>
                <span className="pill-info">
                  Total {edgeWeightLabel(result.weight)}: {result.totalWeight}
                </span>
                <span className="pill-info">No dirigido</span>
              </div>
              <div className="text-xs leading-relaxed text-slate-700">
                {result.path.map((id, i) => (
                  <span key={id}>
                    {i > 0 && <span className="mx-1 text-slate-400">→</span>}
                    <span className="font-medium">{id}</span>
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2 italic">{result.interpretation}</p>
            </>
          ) : (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Sin camino: {result.reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs">
      <div className="text-slate-500 mb-0.5">{label}</div>
      {children}
    </label>
  );
}
