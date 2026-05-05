import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Code2,
  Lock,
  Play,
  RotateCcw,
  Unlock,
} from "lucide-react";
import {
  CYPHER_CATEGORIES,
  CYPHER_PRESETS,
  type CypherPreset,
} from "../data/cypherPresets";
import { CypherResult, SupplyChainApi, asErrorMessage } from "../api/client";
import PageHeader from "../components/PageHeader";
import ConfirmDialog from "../components/ConfirmDialog";

function formatCellValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function QueryExplorer() {
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(CYPHER_CATEGORIES)
  );
  const [selectedId, setSelectedId] = useState<string>(CYPHER_PRESETS[0].id);
  const [cypher, setCypher] = useState<string>(CYPHER_PRESETS[0].cypher);
  const [paramsForm, setParamsForm] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"read" | "write">("read");
  const [pendingMode, setPendingMode] = useState<null | "write">(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CypherResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => CYPHER_PRESETS.find((p) => p.id === selectedId) ?? null,
    [selectedId]
  );

  const setPreset = (preset: CypherPreset) => {
    setSelectedId(preset.id);
    setCypher(preset.cypher);
    const initialParams: Record<string, string> = {};
    for (const p of preset.parameters ?? []) initialParams[p.name] = p.defaultValue;
    setParamsForm(initialParams);
    setResult(null);
    setError(null);
  };

  const buildParams = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(paramsForm)) {
      const asNum = Number(v);
      out[k] = v !== "" && !Number.isNaN(asNum) && /^-?\d+(\.\d+)?$/.test(v.trim()) ? asNum : v;
    }
    return out;
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await SupplyChainApi.executeCypher({
        cypher,
        params: buildParams(),
        mode,
      });
      setResult(res);
      toast.success(`Cypher executed (${res.mode}, ${res.rowCount} rows)`);
    } catch (err) {
      const msg = asErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (selectedPreset) setPreset(selectedPreset);
  };

  return (
    <div>
      <PageHeader
        title="Cypher Query Explorer"
        description="15 ready-made queries (5 categories) plus a free-form Cypher editor with explicit read/write mode. Executes against the Neo4j AuraDB instance."
        badge={
          <span className={mode === "read" ? "pill-info" : "pill-warn"}>
            {mode === "read" ? <Lock size={12} /> : <Unlock size={12} />}
            {mode.toUpperCase()} mode
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <PresetSidebar
          openCategories={openCategories}
          onToggleCategory={(cat) =>
            setOpenCategories((prev) => {
              const next = new Set(prev);
              if (next.has(cat)) next.delete(cat);
              else next.add(cat);
              return next;
            })
          }
          selectedId={selectedId}
          onPick={setPreset}
        />

        <div className="space-y-4">
          {selectedPreset && (
            <div className="card-pad">
              <div className="text-xs uppercase tracking-wider text-slate-400">{selectedPreset.category}</div>
              <h2 className="text-base font-semibold text-slate-900">{selectedPreset.title}</h2>
              <p className="text-sm text-slate-600 mt-1">{selectedPreset.description}</p>
            </div>
          )}

          <div className="card-pad">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Code2 size={14} /> Cypher
              </h3>
              <div className="flex items-center gap-2">
                <ModeSwitch
                  mode={mode}
                  onChange={(next) => {
                    if (next === "write" && mode === "read") setPendingMode("write");
                    else setMode(next);
                  }}
                />
                <button
                  onClick={reset}
                  disabled={!selectedPreset}
                  className="btn-secondary text-xs"
                  title="Reset to preset"
                >
                  <RotateCcw size={13} /> Reset
                </button>
                <button onClick={run} disabled={busy || !cypher.trim()} className="btn-primary text-xs">
                  <Play size={13} />
                  {busy ? "Running..." : "Run"}
                </button>
              </div>
            </div>
            <textarea
              value={cypher}
              onChange={(e) => setCypher(e.target.value)}
              spellCheck={false}
              className="w-full font-mono text-[13px] bg-slate-50 border border-slate-200 rounded-md p-3 leading-snug text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              rows={Math.min(18, Math.max(6, cypher.split("\n").length + 1))}
            />

            {selectedPreset?.parameters && selectedPreset.parameters.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-1.5">Parameters</div>
                <div className="grid grid-cols-2 gap-2">
                  {selectedPreset.parameters.map((p) => (
                    <label key={p.name} className="text-xs">
                      <div className="text-slate-500 mb-0.5">
                        {p.label} <span className="text-slate-400 font-mono">${p.name}</span>
                      </div>
                      <input
                        value={paramsForm[p.name] ?? ""}
                        onChange={(e) =>
                          setParamsForm((prev) => ({ ...prev, [p.name]: e.target.value }))
                        }
                        className="input w-full"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5" /> {error}
              </div>
            )}
          </div>

          {result && <ResultsCard result={result} />}
        </div>
      </div>

      <ConfirmDialog
        open={pendingMode === "write"}
        title="Enable WRITE mode?"
        description="Running queries in write mode can mutate the database (CREATE, MERGE, DELETE, SET). The session will use a write transaction. Continue?"
        confirmLabel="Enable write mode"
        cancelLabel="Stay in read-only"
        destructive
        onConfirm={() => {
          setMode("write");
          setPendingMode(null);
        }}
        onCancel={() => setPendingMode(null)}
      />
    </div>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: "read" | "write";
  onChange: (m: "read" | "write") => void;
}) {
  return (
    <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-xs">
      <button
        onClick={() => onChange("read")}
        className={`px-2.5 py-1 rounded ${mode === "read" ? "bg-white text-brand-600 shadow-sm" : "text-slate-600"}`}
      >
        <span className="inline-flex items-center gap-1">
          <Lock size={11} /> Read
        </span>
      </button>
      <button
        onClick={() => onChange("write")}
        className={`px-2.5 py-1 rounded ${mode === "write" ? "bg-white text-rose-600 shadow-sm" : "text-slate-600"}`}
      >
        <span className="inline-flex items-center gap-1">
          <Unlock size={11} /> Write
        </span>
      </button>
    </div>
  );
}

function PresetSidebar({
  openCategories,
  onToggleCategory,
  selectedId,
  onPick,
}: {
  openCategories: Set<string>;
  onToggleCategory: (cat: string) => void;
  selectedId: string;
  onPick: (preset: CypherPreset) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">Pre-built queries</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          15 examples · 5 categories
        </p>
      </div>
      <ul className="max-h-[640px] overflow-y-auto">
        {CYPHER_CATEGORIES.map((cat) => {
          const queries = CYPHER_PRESETS.filter((p) => p.category === cat);
          const open = openCategories.has(cat);
          return (
            <li key={cat} className="border-b border-slate-100 last:border-b-0">
              <button
                onClick={() => onToggleCategory(cat)}
                className="w-full flex items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50"
              >
                <span>{cat}</span>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {open && (
                <ul>
                  {queries.map((q) => (
                    <li key={q.id}>
                      <button
                        onClick={() => onPick(q)}
                        className={`w-full text-left px-4 py-1.5 text-sm flex items-center justify-between gap-2 ${
                          selectedId === q.id
                            ? "bg-brand-50 text-brand-700 font-medium"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">{q.title}</span>
                        {selectedId === q.id && <ArrowRight size={12} className="shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultsCard({ result }: { result: CypherResult }) {
  const cols = result.columns;
  const stats = Object.entries(result.stats).filter(([, v]) => v !== 0);
  return (
    <div className="card-pad">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Result</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="pill-info">{result.rowCount} rows</span>
          <span className={result.mode === "read" ? "pill-info" : "pill-warn"}>
            {result.mode.toUpperCase()}
          </span>
        </div>
      </div>
      {stats.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {stats.map(([k, v]) => (
            <span key={k} className="pill-info">
              {k}: {v}
            </span>
          ))}
        </div>
      )}
      {result.rows.length === 0 ? (
        <p className="text-sm text-slate-500">Query executed successfully but returned no rows.</p>
      ) : (
        <div className="overflow-auto max-h-[480px] border border-slate-200 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="px-3 py-1.5 text-left font-semibold text-slate-600 border-b border-slate-200"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {cols.map((c) => (
                    <td
                      key={c}
                      className="px-3 py-1 align-top text-slate-700 whitespace-pre-wrap break-words max-w-[480px]"
                    >
                      {formatCellValue(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
