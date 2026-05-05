import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowRight,
  CheckCircle,
  FileSpreadsheet,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  BulkDeleteResult,
  BulkUpdateResult,
  SupplyChainApi,
  asErrorMessage,
} from "../../api/client";
import TypedPropertyEditor, { EditableProperty, buildTypedProperties } from "./TypedPropertyEditor";
import TagInput from "./TagInput";
import Combobox from "./Combobox";
import ConfirmDialog from "../ConfirmDialog";

type Action = "editProps" | "deleteRels" | null;

type Props = {
  relationshipTypes: string[];
  suggestedKeys?: string[];
  onNavigateToCsv?: () => void;
};

export default function BulkRelsPanel({ relationshipTypes, suggestedKeys = [], onNavigateToCsv }: Props) {
  /* ── Step 1: filter ─────────────────────────────── */
  const [filterType, setFilterType] = useState("");
  const [whereRows, setWhereRows] = useState<EditableProperty[]>([]);
  const [limit, setLimit] = useState(100);

  /* ── Step 2: action ─────────────────────────────── */
  const [action, setAction] = useState<Action>(null);

  /* ── Step 3: edit-props fields ──────────────────── */
  const [setRows, setSetRows] = useState<EditableProperty[]>([]);
  const [removeTags, setRemoveTags] = useState<string[]>([]);

  /* ── Execution state ────────────────────────────── */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updateResult, setUpdateResult] = useState<BulkUpdateResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<BulkDeleteResult | null>(null);

  // ── helpers ─────────────────────────────────────────
  const buildFilter = () => {
    const { properties: whereProps, errors } = buildTypedProperties(whereRows);
    if (errors.length > 0) {
      toast.error(`Condición: ${errors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
      return null;
    }
    return {
      type: filterType || undefined,
      where: whereProps.length > 0 ? whereProps : undefined,
    };
  };

  const executeUpdate = async () => {
    const filter = buildFilter();
    if (!filter) return;
    const { properties: setProps, errors } = buildTypedProperties(setRows);
    if (errors.length > 0) {
      toast.error(`Valores: ${errors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
      return;
    }
    if (setProps.length === 0 && removeTags.length === 0) {
      toast.error("Agrega al menos una propiedad a cambiar o una clave a quitar");
      return;
    }
    setBusy(true);
    setUpdateResult(null);
    setDeleteResult(null);
    try {
      const r = await SupplyChainApi.bulkUpdateRelationships({
        filter,
        set: setProps.length > 0 ? setProps : undefined,
        remove: removeTags.length > 0 ? removeTags : undefined,
        limit,
      });
      setUpdateResult(r);
      toast.success(`${r.updated} relación${r.updated !== 1 ? "es" : ""} actualizada${r.updated !== 1 ? "s" : ""}`);
    } catch (err) {
      toast.error(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const executeDelete = async () => {
    const filter = buildFilter();
    if (!filter) return;
    setConfirmOpen(false);
    setBusy(true);
    setUpdateResult(null);
    setDeleteResult(null);
    try {
      const r = await SupplyChainApi.bulkDeleteRelationships({ filter, confirm: true, limit });
      setDeleteResult(r);
      toast.success(`${r.deleted} relación${r.deleted !== 1 ? "es" : ""} eliminada${r.deleted !== 1 ? "s" : ""}`);
    } catch (err) {
      toast.error(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cypherPreview = buildCypherPreview({ filterType, whereRows, action, setRows, removeTags, limit });

  return (
    <div className="space-y-4">
      {/* ── Step 1 ─────────────────────────────────── */}
      <StepCard step={1} title="¿Qué relaciones quieres afectar?">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="label mb-1">Tipo de relación</div>
            <Combobox
              value={filterType}
              onChange={setFilterType}
              suggestions={relationshipTypes}
              placeholder="Cualquier tipo…"
              className="input w-full"
            />
          </div>
          <div>
            <div className="label mb-1">Máximo de relaciones a afectar</div>
            <input
              type="number"
              value={limit}
              min={1}
              max={5000}
              onChange={(e) => setLimit(Math.max(1, Math.min(5000, Number(e.target.value))))}
              className="input w-full"
            />
          </div>
        </div>

        <div>
          <div className="label mb-1">
            Condición adicional{" "}
            <span className="text-slate-400 font-normal">(opcional — filtra por valor de propiedad)</span>
          </div>
          <TypedPropertyEditor
            rows={whereRows}
            onChange={setWhereRows}
            suggestedKeys={suggestedKeys}
          />
        </div>

        {(filterType || whereRows.length > 0) && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500">Se afectarán:</span>
            {filterType && (
              <span className="rounded-full bg-brand-50 border border-brand-200 text-brand-700 px-2 py-0.5 text-[11px] font-medium">
                [:{filterType}]
              </span>
            )}
            {whereRows.filter((r) => r.key && r.raw).map((r, i) => (
              <span key={i} className="rounded-full bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 text-[11px]">
                {r.key} = {r.raw}
              </span>
            ))}
            <span className="text-[11px] text-slate-400">· hasta {limit} relaciones</span>
          </div>
        )}
      </StepCard>

      {/* ── Step 2 ─────────────────────────────────── */}
      <StepCard step={2} title="¿Qué quieres hacer?">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ActionCard
            icon={<Pencil size={20} />}
            title="Editar propiedades"
            description="Agrega, cambia o quita propiedades en todas las relaciones del filtro."
            selected={action === "editProps"}
            onClick={() => setAction("editProps")}
            color="brand"
          />
          <ActionCard
            icon={<Trash2 size={20} />}
            title="Eliminar relaciones"
            description="Borra permanentemente las relaciones que coincidan con el filtro."
            selected={action === "deleteRels"}
            onClick={() => setAction("deleteRels")}
            color="rose"
          />
          <ActionCard
            icon={<FileSpreadsheet size={20} />}
            title="Crear múltiples relaciones"
            description="Importa relaciones nuevas en masa desde un archivo CSV."
            selected={false}
            onClick={() => onNavigateToCsv?.()}
            color="emerald"
          />
        </div>
      </StepCard>

      {/* ── Step 3 ─────────────────────────────────── */}
      {action === "editProps" && (
        <StepCard step={3} title="Cambios a aplicar">
          <div className="space-y-4">
            <div>
              <div className="label mb-1">Agregar o cambiar valores</div>
              <p className="text-[11px] text-slate-500 mb-2">
                Las claves que ya existan se sobreescribirán; las nuevas se añadirán.
              </p>
              <TypedPropertyEditor
                rows={setRows}
                onChange={setSetRows}
                suggestedKeys={suggestedKeys}
              />
            </div>

            <div>
              <div className="label mb-1">Quitar claves</div>
              <p className="text-[11px] text-slate-500 mb-2">
                Escribe el nombre de la clave y presiona{" "}
                <kbd className="text-[10px] bg-slate-100 px-1 rounded">Enter</kbd>.
              </p>
              <TagInput
                value={removeTags}
                onChange={setRemoveTags}
                suggestions={suggestedKeys}
                placeholder="Escribe un nombre de clave y presiona Enter…"
              />
            </div>

            {cypherPreview && <CypherPreview cypher={cypherPreview} />}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button onClick={executeUpdate} disabled={busy} className="btn-primary">
                {busy ? "Ejecutando…" : (
                  <span className="flex items-center gap-1.5">
                    <ArrowRight size={14} />
                    Aplicar cambios a las relaciones
                  </span>
                )}
              </button>
            </div>
          </div>
        </StepCard>
      )}

      {action === "deleteRels" && (
        <StepCard step={3} title="Confirmar eliminación">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
              <XCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
              <div>
                <p className="font-semibold mb-0.5">Esta acción no se puede deshacer.</p>
                <p className="text-xs">
                  Se ejecutará <code className="font-mono bg-rose-100 px-1 rounded">DELETE</code> en todas las
                  relaciones del filtro (hasta {limit}). Los nodos conectados no serán eliminados.
                </p>
              </div>
            </div>
            {cypherPreview && <CypherPreview cypher={cypherPreview} />}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition"
              >
                <Trash2 size={14} />
                {busy ? "Eliminando…" : "Eliminar relaciones"}
              </button>
            </div>
          </div>
        </StepCard>
      )}

      {/* Results */}
      {updateResult && <ResultCard type="update" result={updateResult} />}
      {deleteResult && <ResultCard type="delete" deleteResult={deleteResult} />}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Eliminar relaciones masivamente?"
        description={`Se borrar${filterType ? `án las relaciones :${filterType}` : "án relaciones"} que cumplan el filtro, hasta un máximo de ${limit}. Esta operación no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        destructive
        onConfirm={executeDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card-pad">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold shrink-0">
          {step}
        </span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ActionCard({
  icon, title, description, selected, onClick, color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  color: "brand" | "rose" | "emerald";
}) {
  const colors = {
    brand:   { base: "border-slate-200 hover:border-brand-300 hover:bg-brand-50/40",   selected: "border-brand-400 bg-brand-50 ring-2 ring-brand-200",   icon: "text-brand-600" },
    rose:    { base: "border-slate-200 hover:border-rose-300 hover:bg-rose-50/40",     selected: "border-rose-400 bg-rose-50 ring-2 ring-rose-200",     icon: "text-rose-600" },
    emerald: { base: "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40", selected: "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200", icon: "text-emerald-600" },
  };
  const c = colors[color];
  return (
    <button
      onClick={onClick}
      className={`text-left p-3.5 rounded-lg border transition ${selected ? c.selected : c.base}`}
    >
      <div className={`mb-2 ${c.icon}`}>{icon}</div>
      <div className="text-sm font-semibold text-slate-800 mb-0.5">{title}</div>
      <div className="text-[11px] text-slate-500 leading-relaxed">{description}</div>
    </button>
  );
}

function CypherPreview({ cypher }: { cypher: string }) {
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">
        Vista previa Cypher (para verificar en AuraDB)
      </div>
      <pre className="text-[11px] text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
        {cypher}
      </pre>
    </div>
  );
}

function ResultCard({ type, result, deleteResult }: { type: "update" | "delete"; result?: BulkUpdateResult; deleteResult?: BulkDeleteResult }) {
  if (type === "update" && result) {
    return (
      <div className="card-pad border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={15} className="text-emerald-600" />
          <span className="text-sm font-semibold text-slate-700">
            {result.updated} de {result.matched} relaciones actualizadas
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          {result.set.length > 0 && <div><span className="font-medium text-slate-500">Claves modificadas:</span> <code>{result.set.join(", ")}</code></div>}
          {result.removed.length > 0 && <div><span className="font-medium text-slate-500">Claves eliminadas:</span> <code>{result.removed.join(", ")}</code></div>}
        </div>
      </div>
    );
  }
  if (type === "delete" && deleteResult) {
    return (
      <div className="card-pad border-l-4 border-l-rose-500">
        <div className="flex items-center gap-2">
          <Trash2 size={15} className="text-rose-600" />
          <span className="text-sm font-semibold text-slate-700">
            {deleteResult.deleted} relación{deleteResult.deleted !== 1 ? "es" : ""} eliminada{deleteResult.deleted !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

// ── Cypher preview builder ────────────────────────────────────────────────────

function buildCypherPreview({
  filterType,
  whereRows,
  action,
  setRows,
  removeTags,
  limit,
}: {
  filterType: string;
  whereRows: EditableProperty[];
  action: Action;
  setRows: EditableProperty[];
  removeTags: string[];
  limit: number;
}): string | null {
  if (!action) return null;

  const typeClause = filterType ? `[:${filterType}]` : "";
  const whereClauses = whereRows
    .filter((r) => r.key && r.raw)
    .map((r) => `r.${r.key} = ${r.type === "string" ? `'${r.raw}'` : r.raw}`);
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  if (action === "deleteRels") {
    return [`MATCH ()-[r${typeClause}]->()`, whereClause, `WITH r LIMIT ${limit}`, `DELETE r`]
      .filter(Boolean)
      .join("\n");
  }

  if (action === "editProps") {
    const lines: string[] = [
      `MATCH ()-[r${typeClause}]->()`,
      whereClause,
      `WITH r LIMIT ${limit}`,
    ].filter(Boolean);

    const setLines = setRows
      .filter((r) => r.key && r.raw)
      .map((r) => `  r.${r.key} = ${r.type === "string" ? `'${r.raw}'` : r.raw}`);
    if (setLines.length > 0) lines.push(`SET\n${setLines.join(",\n")}`);

    const removeLines = removeTags.map((k) => `r.${k}`);
    if (removeLines.length > 0) lines.push(`REMOVE ${removeLines.join(", ")}`);

    return lines.join("\n");
  }

  return null;
}
