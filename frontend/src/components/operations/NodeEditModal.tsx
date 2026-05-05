import { useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { GraphNode, SupplyChainApi, asErrorMessage } from "../../api/client";
import TypedPropertyEditor, { EditableProperty, buildTypedProperties } from "./TypedPropertyEditor";

type Props = {
  node: GraphNode | null;
  onClose: () => void;
  onUpdated: () => void;
};

export default function NodeEditModal({ node, onClose, onUpdated }: Props) {
  const [setRows, setSetRows] = useState<EditableProperty[]>([]);
  const [removeKeys, setRemoveKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!node) return null;

  const existingKeys = Object.keys(node.properties);
  const nodeId = (node.properties as Record<string, unknown>).id as string | undefined;
  const lookupKey = nodeId ?? node.elementId;
  const lookupBy: "id" | "elementId" = nodeId ? "id" : "elementId";

  const toggleRemove = (k: string) => {
    setRemoveKeys((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  };

  const submit = async () => {
    const { properties: setProps, errors } = buildTypedProperties(setRows);
    if (errors.length > 0) {
      toast.error(`Propiedades: ${errors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
      return;
    }
    if (setProps.length === 0 && removeKeys.length === 0) {
      toast.error("Define al menos una propiedad a agregar/actualizar o eliminar");
      return;
    }
    setBusy(true);
    try {
      await SupplyChainApi.updateNode(
        lookupKey,
        { set: setProps.length > 0 ? setProps : undefined, remove: removeKeys.length > 0 ? removeKeys : undefined },
        lookupBy
      );
      toast.success("Nodo actualizado");
      setSetRows([]);
      setRemoveKeys([]);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl card-pad mt-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Gestionar propiedades del nodo</h2>
            <p className="text-xs text-slate-500">
              {node.labels.join(":")}
              {nodeId ? ` · id = ${nodeId}` : ` · elementId = ${node.elementId}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 p-3 rounded bg-slate-50 border border-slate-200">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Propiedades actuales
          </div>
          <div className="flex flex-wrap gap-1.5">
            {existingKeys.map((k) => (
              <span key={k} className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700">
                <span className="text-slate-500">{k}:</span>{" "}
                {String(node.properties[k] ?? "—").slice(0, 40)}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="label mb-1">Agregar / actualizar propiedades</div>
          <p className="text-[11px] text-slate-500 mb-2">
            Las claves existentes se sobreescribirán; las nuevas se añadirán.
          </p>
          <TypedPropertyEditor rows={setRows} onChange={setSetRows} />
        </div>

        {existingKeys.length > 0 && (
          <div className="mb-4">
            <div className="label mb-1">Eliminar propiedades</div>
            <p className="text-[11px] text-slate-500 mb-2">Haz clic en la clave para marcarla como eliminada.</p>
            <div className="flex flex-wrap gap-1.5">
              {existingKeys.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleRemove(k)}
                  className={`rounded px-2 py-0.5 text-xs border transition ${
                    removeKeys.includes(k)
                      ? "border-rose-400 bg-rose-50 text-rose-700 font-medium"
                      : "border-slate-200 bg-white text-slate-600 hover:border-rose-300"
                  }`}
                >
                  {removeKeys.includes(k) ? "✕ " : ""}
                  {k}
                </button>
              ))}
            </div>
            {removeKeys.length > 0 && (
              <p className="text-[11px] text-rose-600 mt-1.5">
                Se eliminarán: {removeKeys.join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
