import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Code2,
  Lock,
  Play,
  RotateCcw,
  ShieldCheck,
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

const VALIDATION_CATEGORY = "Validación de rúbrica";

/**
 * Build a Cypher snippet with `:param` declarations followed by the query
 * itself, ready to paste into Aura Console.
 *
 * Aura accepts `:param name => value` lines that bind parameters for the
 * subsequent query. We use that instead of inlining literals so the result is
 * still a single editable block.
 */
function buildCopyableCypher(cypher: string, params: Record<string, string>): string {
  const lines: string[] = [];
  for (const [name, raw] of Object.entries(params)) {
    if (raw === "") continue;
    const isNum = /^-?\d+(\.\d+)?$/.test(raw.trim());
    const isBool = raw === "true" || raw === "false";
    let literal: string;
    if (isNum) literal = raw;
    else if (isBool) literal = raw;
    else literal = `'${raw.replace(/'/g, "\\'")}'`;
    lines.push(`:param ${name} => ${literal};`);
  }
  if (lines.length > 0) lines.push("");
  lines.push(cypher);
  return lines.join("\n");
}

function formatCellValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function QueryExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialId = searchParams.get("preset") ?? CYPHER_PRESETS[0].id;
  const initialPreset =
    CYPHER_PRESETS.find((p) => p.id === initialId) ?? CYPHER_PRESETS[0];

  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(CYPHER_CATEGORIES)
  );
  const [selectedId, setSelectedId] = useState<string>(initialPreset.id);
  const [cypher, setCypher] = useState<string>(initialPreset.cypher);
  const [paramsForm, setParamsForm] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of initialPreset.parameters ?? []) {
      const fromUrl = searchParams.get(`p_${p.name}`);
      out[p.name] = fromUrl ?? p.defaultValue;
    }
    return out;
  });
  const [mode, setMode] = useState<"read" | "write">("read");
  const [pendingMode, setPendingMode] = useState<null | "write">(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CypherResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationStep, setValidationStep] = useState<1 | 2>(() => {
    const raw = searchParams.get("step");
    return raw === "2" ? 2 : 1;
  });

  const selectedPreset = useMemo(
    () => CYPHER_PRESETS.find((p) => p.id === selectedId) ?? null,
    [selectedId]
  );

  // Sync the deep-link query params when the user picks a preset or switches
  // step. Keeps URLs shareable (rubric matrix relies on this).
  useEffect(() => {
    if (!selectedPreset) return;
    const next = new URLSearchParams(searchParams);
    next.set("preset", selectedPreset.id);
    if (selectedPreset.category === VALIDATION_CATEGORY) {
      next.set("step", String(validationStep));
    } else {
      next.delete("step");
    }
    for (const p of selectedPreset.parameters ?? []) {
      next.set(`p_${p.name}`, paramsForm[p.name] ?? p.defaultValue);
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset?.id, paramsForm, validationStep]);

  const setPreset = (preset: CypherPreset) => {
    setSelectedId(preset.id);
    setCypher(preset.cypher);
    const initialParams: Record<string, string> = {};
    for (const p of preset.parameters ?? []) {
      const fromUrl = searchParams.get(`p_${p.name}`);
      initialParams[p.name] = fromUrl ?? p.defaultValue;
    }
    setParamsForm(initialParams);
    setResult(null);
    setError(null);
    setValidationStep(1);
  };

  const copyCypherWithParams = async () => {
    const text = buildCopyableCypher(cypher, paramsForm);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Cypher copiado (con :param) al portapapeles");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
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
      const modeEtiqueta = res.mode === "read" ? "lectura" : "escritura";
      toast.success(`Cypher ejecutado (${modeEtiqueta}, ${res.rowCount} filas)`);
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
        title="Explorador de consultas Cypher"
        description="15 consultas en 5 categorías y editor Cypher libre con modo lectura o escritura explícito. Se ejecuta contra la instancia Neo4j AuraDB."
        badge={
          <span className={mode === "read" ? "pill-info" : "pill-warn"}>
            {mode === "read" ? <Lock size={12} /> : <Unlock size={12} />}
            Modo {mode === "read" ? "LECTURA" : "ESCRITURA"}
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
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-slate-400">
                  {selectedPreset.category}
                </div>
                {selectedPreset.category === VALIDATION_CATEGORY && (
                  <ValidationStepSwitch
                    step={validationStep}
                    onChange={setValidationStep}
                  />
                )}
              </div>
              <h2 className="text-base font-semibold text-slate-900">{selectedPreset.title}</h2>
              <p className="text-sm text-slate-600 mt-1">{selectedPreset.description}</p>
              {selectedPreset.validationHint && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                  <span>{selectedPreset.validationHint}</span>
                </div>
              )}
              {selectedPreset.rubricCriteria && selectedPreset.rubricCriteria.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedPreset.rubricCriteria.map((cid) => (
                    <span key={cid} className="pill-info text-[11px]">
                      Rúbrica · ítem {cid}
                    </span>
                  ))}
                </div>
              )}
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
                  onClick={copyCypherWithParams}
                  disabled={!cypher.trim()}
                  className="btn-secondary text-xs"
                  title="Copiar al portapapeles con :param prellenados (formato Aura Console)"
                >
                  <ClipboardCopy size={13} /> Copiar
                </button>
                <button
                  onClick={reset}
                  disabled={!selectedPreset}
                  className="btn-secondary text-xs"
                  title="Restaurar la plantilla"
                >
                  <RotateCcw size={13} /> Restablecer
                </button>
                <button onClick={run} disabled={busy || !cypher.trim()} className="btn-primary text-xs">
                  <Play size={13} />
                  {busy ? "Ejecutando…" : "Ejecutar"}
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
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-1.5">Parámetros</div>
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
        title="¿Activar modo ESCRITURA?"
        description="En modo escritura las consultas pueden modificar la base de datos (CREATE, MERGE, DELETE, SET). La sesión usará una transacción de escritura. ¿Continuar?"
        confirmLabel="Activar escritura"
        cancelLabel="Permanecer en solo lectura"
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

function ValidationStepSwitch({
  step,
  onChange,
}: {
  step: 1 | 2;
  onChange: (s: 1 | 2) => void;
}) {
  return (
    <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-[11px]">
      <button
        onClick={() => onChange(1)}
        className={`px-2 py-0.5 rounded ${
          step === 1
            ? "bg-white text-brand-600 shadow-sm font-medium"
            : "text-slate-600"
        }`}
        title="Snapshot ANTES de la operación"
      >
        Paso 1 · Antes
      </button>
      <button
        onClick={() => onChange(2)}
        className={`px-2 py-0.5 rounded inline-flex items-center gap-1 ${
          step === 2
            ? "bg-white text-emerald-600 shadow-sm font-medium"
            : "text-slate-600"
        }`}
        title="Snapshot DESPUÉS de la operación"
      >
        <CheckCheck size={11} /> Paso 2 · Después
      </button>
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
          <Lock size={11} /> Lectura
        </span>
      </button>
      <button
        onClick={() => onChange("write")}
        className={`px-2.5 py-1 rounded ${mode === "write" ? "bg-white text-rose-600 shadow-sm" : "text-slate-600"}`}
      >
        <span className="inline-flex items-center gap-1">
          <Unlock size={11} /> Escritura
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
        <h3 className="text-sm font-semibold text-slate-700">Consultas predefinidas</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          15 ejemplos · 5 categorías
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
        <h3 className="text-sm font-semibold text-slate-700">Resultado</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="pill-info">{result.rowCount} filas</span>
          <span className={result.mode === "read" ? "pill-info" : "pill-warn"}>
            {result.mode === "read" ? "LECTURA" : "ESCRITURA"}
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
        <p className="text-sm text-slate-500">Consulta ejecutada correctamente; no devolvió filas.</p>
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
