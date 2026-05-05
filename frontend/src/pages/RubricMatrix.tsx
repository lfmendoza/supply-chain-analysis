import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ExternalLink,
  Minus,
} from "lucide-react";
import {
  ConnectivityReport,
  DataTypeReport,
  GraphSummary,
  SupplyChainApi,
  asErrorMessage,
} from "../api/client";
import PageHeader from "../components/PageHeader";
import {
  RUBRIC,
  RUBRIC_BY_CATEGORY,
  RUBRIC_TOTAL_POINTS,
  RUBRIC_EXTRA_POINTS,
  RUBRIC_MAX_POINTS,
  type RubricCriterion,
  type ValidationStep,
} from "../data/rubric";
import { CYPHER_PRESETS } from "../data/cypherPresets";

const SESSION_STORAGE_KEY = "rubricValidatedSteps_v1";
type AutoStatus = "auto-ok" | "warn" | "manual";

type SummaryFlags = {
  totalNodes: number;
  labelsCount: number;
  relTypesCount: number;
};

function loadValidatedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveValidatedSet(set: Set<string>): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // sessionStorage may be unavailable in some embeds; silently ignore.
  }
}

function presetById(id?: string) {
  if (!id) return null;
  return CYPHER_PRESETS.find((p) => p.id === id) ?? null;
}

function buildExplorerLink(step: ValidationStep, runStep: 1 | 2): string {
  const preset = presetById(step.presetId);
  if (!preset) return "/queries";
  const params = new URLSearchParams();
  params.set("preset", preset.id);
  params.set("step", String(runStep));
  for (const p of preset.parameters ?? []) {
    params.set(`p_${p.name}`, p.defaultValue);
  }
  return `/queries?${params.toString()}`;
}

export default function RubricMatrix() {
  const [connectivity, setConnectivity] = useState<ConnectivityReport | null>(null);
  const [dataTypes, setDataTypes] = useState<DataTypeReport | null>(null);
  const [summary, setSummary] = useState<GraphSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState<Set<string>>(loadValidatedSet);

  useEffect(() => {
    Promise.all([
      SupplyChainApi.connectivity().then(setConnectivity),
      SupplyChainApi.dataTypes().then(setDataTypes),
      SupplyChainApi.graphSummary().then(setSummary),
    ]).catch((e) => setError(asErrorMessage(e)));
  }, []);

  const summaryFlags: SummaryFlags | null = useMemo(() => {
    if (!summary) return null;
    return {
      totalNodes: Object.values(summary.counts).reduce((a, b) => a + b, 0),
      labelsCount: Object.keys(summary.counts).length,
      relTypesCount: new Set(summary.edges.map((e) => e.relType)).size,
    };
  }, [summary]);

  const autoStatus = (c: RubricCriterion): AutoStatus => {
    switch (c.liveCheck) {
      case "connectivity":
        if (!connectivity) return "manual";
        return connectivity.isConnected ? "auto-ok" : "warn";
      case "dataTypes":
        if (!dataTypes) return "manual";
        return Object.values(dataTypes.coverage).every(Boolean) ? "auto-ok" : "warn";
      case "summary":
        if (!summaryFlags) return "manual";
        return summaryFlags.totalNodes > 50 ? "auto-ok" : "warn";
      case "datasetSize":
        if (!summaryFlags) return "manual";
        return summaryFlags.totalNodes >= 5000 ? "auto-ok" : "warn";
      case "labelCount":
        if (!summaryFlags) return "manual";
        return summaryFlags.labelsCount >= 5 ? "auto-ok" : "warn";
      case "relTypeCount":
        if (!summaryFlags) return "manual";
        return summaryFlags.relTypesCount >= 10 ? "auto-ok" : "warn";
      default:
        return "manual";
    }
  };

  const stepKey = (criterionId: number, stepIdx: number) =>
    `${criterionId}.${stepIdx}`;
  const isValidated = (criterionId: number, stepIdx: number) =>
    validated.has(stepKey(criterionId, stepIdx));

  const toggleValidated = (criterionId: number, stepIdx: number) => {
    const key = stepKey(criterionId, stepIdx);
    setValidated((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveValidatedSet(next);
      return next;
    });
  };

  const criterionStatus = (
    c: RubricCriterion
  ): "auto-ok" | "manual-ok" | "warn" | "pending" => {
    const auto = autoStatus(c);
    const totalSteps = c.steps.length;
    const okSteps = c.steps.filter((_, i) => isValidated(c.id, i)).length;
    if (auto === "auto-ok" && okSteps === totalSteps) return "auto-ok";
    if (okSteps === totalSteps) return "manual-ok";
    if (auto === "warn") return "warn";
    return "pending";
  };

  const totals = useMemo(() => {
    let earned = 0;
    let earnedExtra = 0;
    let totalChecked = 0;
    let totalSteps = 0;
    for (const c of RUBRIC) {
      const s = criterionStatus(c);
      const pts = c.points;
      if (s === "auto-ok" || s === "manual-ok") {
        if (c.extra) earnedExtra += pts;
        else earned += pts;
      }
      totalSteps += c.steps.length;
      totalChecked += c.steps.filter((_, i) => isValidated(c.id, i)).length;
    }
    return { earned, earnedExtra, totalChecked, totalSteps };
  }, [validated, connectivity, dataTypes, summary]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Matriz de validación de rúbrica"
        description="Por cada criterio: PRE (snapshot), Acción (UI o API) y POST (mismo snapshot). El delta entre PRE y POST es la evidencia."
        badge={
          <span className="pill-info">
            <ClipboardCheck size={12} />
            {totals.totalChecked}/{totals.totalSteps} pasos validados ·{" "}
            {totals.earned}/{RUBRIC_TOTAL_POINTS} pts ({totals.earnedExtra} extra/{RUBRIC_EXTRA_POINTS}, máx {RUBRIC_MAX_POINTS})
          </span>
        }
      />

      {error && (
        <div className="card-pad border-rose-200 bg-rose-50 text-rose-700 text-sm">{error}</div>
      )}

      <div className="card-pad">
        <h2 className="text-sm font-semibold text-slate-700">Cómo usar esta matriz</h2>
        <ol className="mt-2 list-decimal pl-5 text-xs text-slate-600 space-y-1">
          <li>Abrir el preset de "Antes" — fija el estado inicial en el explorador o en Aura Console.</li>
          <li>Ejecutar la acción (UI con la pista, o el comando curl/API documentado en el paso).</li>
          <li>Volver al preset (botón "Después") y comparar el delta: nuevas filas, contadores cambiados, etc.</li>
          <li>Marcar el paso como validado para sumar puntos al total.</li>
        </ol>
      </div>

      {Object.entries(RUBRIC_BY_CATEGORY).map(([category, items]) => (
        <CategoryBlock
          key={category}
          category={category}
          items={items}
          autoStatus={autoStatus}
          isValidated={isValidated}
          toggleValidated={toggleValidated}
          criterionStatus={criterionStatus}
        />
      ))}
    </div>
  );
}

function CategoryBlock({
  category,
  items,
  autoStatus,
  isValidated,
  toggleValidated,
  criterionStatus,
}: {
  category: string;
  items: RubricCriterion[];
  autoStatus: (c: RubricCriterion) => AutoStatus;
  isValidated: (criterionId: number, stepIdx: number) => boolean;
  toggleValidated: (criterionId: number, stepIdx: number) => void;
  criterionStatus: (c: RubricCriterion) => "auto-ok" | "manual-ok" | "warn" | "pending";
}) {
  const blockPoints = items.reduce((s, c) => s + c.points, 0);

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          {category}
        </h2>
        <span className="text-xs text-slate-500">
          {items.length} criterios · {blockPoints} pts
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((c) => (
          <CriterionRow
            key={c.id}
            criterion={c}
            autoStatus={autoStatus(c)}
            criterionStatus={criterionStatus(c)}
            isValidated={isValidated}
            toggleValidated={toggleValidated}
          />
        ))}
      </div>
    </div>
  );
}

function CriterionRow({
  criterion,
  autoStatus: auto,
  criterionStatus: status,
  isValidated,
  toggleValidated,
}: {
  criterion: RubricCriterion;
  autoStatus: AutoStatus;
  criterionStatus: "auto-ok" | "manual-ok" | "warn" | "pending";
  isValidated: (criterionId: number, stepIdx: number) => boolean;
  toggleValidated: (criterionId: number, stepIdx: number) => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <CriterionStatusPill status={status} auto={auto} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-slate-400 tabular-nums">{criterion.id}.</span>
            <h3 className="text-sm font-medium text-slate-900">{criterion.title}</h3>
            <span className="ml-auto text-xs text-slate-500 tabular-nums">
              {criterion.points} pts {criterion.extra && <em className="text-amber-600">(extra)</em>}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {criterion.steps.map((step, i) => (
              <StepRow
                key={i}
                criterionId={criterion.id}
                stepIdx={i}
                step={step}
                checked={isValidated(criterion.id, i)}
                onToggle={() => toggleValidated(criterion.id, i)}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  criterionId,
  stepIdx,
  step,
  checked,
  onToggle,
}: {
  criterionId: number;
  stepIdx: number;
  step: ValidationStep;
  checked: boolean;
  onToggle: () => void;
}) {
  const presetExists = step.presetId && presetById(step.presetId);
  return (
    <li className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
      <div className="flex items-start gap-2">
        <button
          onClick={onToggle}
          className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border ${
            checked
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300 bg-white text-transparent hover:border-slate-400"
          }`}
          title={checked ? "Marcar como pendiente" : "Marcar como validado"}
        >
          <CheckCircle2 size={12} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-800">{step.label}</div>
          {step.actionHint && (
            <div className="text-[11px] text-slate-500 mt-0.5">{step.actionHint}</div>
          )}
          {step.apiCall && (
            <pre className="mt-1.5 max-w-full overflow-x-auto rounded bg-slate-900 px-2 py-1.5 text-[10px] leading-snug text-slate-100">
              <code>{step.apiCall}</code>
            </pre>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {presetExists ? (
              <>
                <Link
                  to={buildExplorerLink(step, 1)}
                  className="pill-info text-[11px] hover:bg-brand-100"
                >
                  <Circle size={10} /> Antes (PRE)
                </Link>
                <ChevronRight size={11} className="text-slate-300" />
                {step.actionPath && (
                  <>
                    <Link
                      to={step.actionPath}
                      className="pill-info text-[11px] hover:bg-brand-100"
                    >
                      <ExternalLink size={10} />
                      Acción · {step.actionPath}
                    </Link>
                    <ChevronRight size={11} className="text-slate-300" />
                  </>
                )}
                <Link
                  to={buildExplorerLink(step, 2)}
                  className="pill-ok text-[11px] hover:bg-emerald-100"
                >
                  <CheckCircle2 size={10} /> Después (POST)
                </Link>
              </>
            ) : step.actionPath ? (
              <Link to={step.actionPath} className="pill-info text-[11px] hover:bg-brand-100">
                <ExternalLink size={10} /> Abrir {step.actionPath}
                <ArrowRight size={11} />
              </Link>
            ) : (
              <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                <Minus size={10} /> Solo manual
              </span>
            )}
          </div>
        </div>
      </div>
      <input type="hidden" value={`${criterionId}.${stepIdx}`} />
    </li>
  );
}

function CriterionStatusPill({
  status,
  auto,
}: {
  status: "auto-ok" | "manual-ok" | "warn" | "pending";
  auto: AutoStatus;
}) {
  if (status === "auto-ok") {
    return (
      <span className="pill-ok text-[11px]">
        <CheckCircle2 size={11} /> Auto-OK
      </span>
    );
  }
  if (status === "manual-ok") {
    return (
      <span className="pill-ok text-[11px]">
        <CheckCircle2 size={11} /> Validado
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span className="pill-warn text-[11px]">
        <Circle size={11} /> Revisar
      </span>
    );
  }
  return (
    <span className={`text-[11px] ${auto === "manual" ? "pill-info" : "pill-warn"}`}>
      <Circle size={11} /> Pendiente
    </span>
  );
}
