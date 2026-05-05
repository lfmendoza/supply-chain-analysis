import { useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle, Layers, Trash2, Wrench } from "lucide-react";
import { BulkDeleteResult, BulkUpdateResult, SupplyChainApi, TypedProperty, asErrorMessage } from "../../api/client";
import TypedPropertyEditor, { EditableProperty, buildTypedProperties } from "./TypedPropertyEditor";
import ConfirmDialog from "../ConfirmDialog";

type Action = "update" | "delete";

type Props = {
  labels: string[];
};

export default function BulkNodesPanel({ labels }: Props) {
  const [filterLabel, setFilterLabel] = useState("");
  const [whereRows, setWhereRows] = useState<EditableProperty[]>([]);
  const [limit, setLimit] = useState(100);
  const [action, setAction] = useState<Action>("update");

  // update-specific
  const [setRows, setSetRows] = useState<EditableProperty[]>([]);
  const [removeInput, setRemoveInput] = useState("");

  // delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [updateResult, setUpdateResult] = useState<BulkUpdateResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<BulkDeleteResult | null>(null);

  const buildFilter = () => {
    const { properties: whereProps, errors } = buildTypedProperties(whereRows);
    if (errors.length > 0) {
      toast.error(`Filtro WHERE: ${errors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
      return null;
    }
    return {
      label: filterLabel || undefined,
      where: whereProps.length > 0 ? whereProps : undefined,
    };
  };

  const executeUpdate = async () => {
    const filter = buildFilter();
    if (!filter) return;
    const { properties: setProps, errors: setErrors } = buildTypedProperties(setRows);
    if (setErrors.length > 0) {
      toast.error(`SET: ${setErrors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
      return;
    }
    const removeKeys = removeInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (setProps.length === 0 && removeKeys.length === 0) {
      toast.error("Define propiedades a actualizar/agregar (SET) o a eliminar (REMOVE)");
      return;
    }
    setBusy(true);
    setUpdateResult(null);
    setDeleteResult(null);
    try {
      const r = await SupplyChainApi.bulkUpdateNodes({
        filter,
        set: setProps.length > 0 ? setProps : undefined,
        remove: removeKeys.length > 0 ? removeKeys : undefined,
        limit,
      });
      setUpdateResult(r);
      toast.success(`Actualizados ${r.updated} de ${r.matched} nodos`);
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
      const r = await SupplyChainApi.bulkDeleteNodes({ filter, confirm: true, limit });
      setDeleteResult(r);
      toast.success(`Eliminados ${r.deleted} nodos`);
    } catch (err) {
      toast.error(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-pad">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={14} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-700">Operaciones masivas · Nodos</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Filtra nodos por etiqueta y/o propiedades (WHERE), luego elige si actualizar/agregar/eliminar propiedades o
          borrar los nodos que coincidan. El campo <em>Límite</em> protege contra cambios accidentales masivos.
        </p>

        {/* Filter */}
        <fieldset className="border border-slate-200 rounded p-3 mb-4">
          <legend className="text-xs font-semibold text-slate-600 px-1">Filtro (¿qué nodos afectar?)</legend>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="label mb-1">Etiqueta</div>
              <select value={filterLabel} onChange={(e) => setFilterLabel(e.target.value)} className="input w-full">
                <option value="">Cualquier etiqueta</option>
                {labels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label mb-1">Límite de nodos a afectar</div>
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
          <div className="label mb-1">Condiciones adicionales (WHERE) — opcional</div>
          <TypedPropertyEditor rows={whereRows} onChange={setWhereRows} />
        </fieldset>

        {/* Action selector */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-xs font-semibold text-slate-600">Acción:</div>
          <button
            onClick={() => setAction("update")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition ${
              action === "update"
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
            }`}
          >
            <Wrench size={12} /> Actualizar propiedades
          </button>
          <button
            onClick={() => setAction("delete")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition ${
              action === "delete"
                ? "border-rose-400 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-rose-300"
            }`}
          >
            <Trash2 size={12} /> Eliminar nodos
          </button>
        </div>

        {action === "update" && (
          <div className="space-y-4">
            <fieldset className="border border-slate-200 rounded p-3">
              <legend className="text-xs font-semibold text-slate-600 px-1">SET — agregar / actualizar propiedades</legend>
              <TypedPropertyEditor rows={setRows} onChange={setSetRows} />
            </fieldset>
            <fieldset className="border border-slate-200 rounded p-3">
              <legend className="text-xs font-semibold text-slate-600 px-1">REMOVE — eliminar propiedades (claves separadas por coma)</legend>
              <input
                value={removeInput}
                onChange={(e) => setRemoveInput(e.target.value)}
                placeholder="p. ej. tempFlag, legacyCode"
                className="input w-full"
              />
            </fieldset>
            <div className="flex justify-end">
              <button onClick={executeUpdate} disabled={busy} className="btn-primary text-sm">
                {busy ? "Ejecutando…" : "Ejecutar actualización masiva"}
              </button>
            </div>
          </div>
        )}

        {action === "delete" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                Se ejecutará <code className="font-mono">DETACH DELETE</code> en todos los nodos que coincidan con el
                filtro (hasta el límite configurado). Esta operación <strong>no se puede deshacer</strong>.
              </span>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition"
              >
                <Trash2 size={14} /> Eliminar nodos masivamente
              </button>
            </div>
          </div>
        )}
      </div>

      {updateResult && <UpdateResultCard result={updateResult} />}
      {deleteResult && <DeleteResultCard result={deleteResult} />}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Eliminar nodos masivamente?"
        description={`Se hará DETACH DELETE de hasta ${limit} nodos que coincidan con el filtro. Esto no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        destructive
        onConfirm={executeDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function UpdateResultCard({ result }: { result: BulkUpdateResult }) {
  return (
    <div className="card-pad">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle size={14} className="text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-700">Resultado de la actualización masiva</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
        <Stat label="Encontrados" value={result.matched} />
        <Stat label="Actualizados" value={result.updated} />
        <Stat label="Propiedades SET" value={result.set.join(", ") || "—"} />
        <Stat label="Propiedades REMOVE" value={result.removed.join(", ") || "—"} />
      </div>
      {result.sampleIds && result.sampleIds.length > 0 && (
        <p className="text-[11px] text-slate-500">
          Muestra de IDs afectados: {result.sampleIds.slice(0, 10).join(", ")}
          {result.sampleIds.length > 10 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

function DeleteResultCard({ result }: { result: BulkDeleteResult }) {
  return (
    <div className="card-pad">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 size={14} className="text-rose-600" />
        <h3 className="text-sm font-semibold text-slate-700">Resultado de la eliminación masiva</h3>
      </div>
      <Stat label="Nodos eliminados" value={result.deleted} />
      {result.sampleIds && result.sampleIds.length > 0 && (
        <p className="text-[11px] text-slate-500 mt-2">
          Muestra de IDs eliminados: {result.sampleIds.slice(0, 10).join(", ")}
          {result.sampleIds.length > 10 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 border border-slate-200 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums truncate">{value}</div>
    </div>
  );
}
