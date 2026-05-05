import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { SupplyChainApi, asErrorMessage } from "../../api/client";
import TypedPropertyEditor, {
  buildTypedProperties,
  type EditableProperty,
} from "./TypedPropertyEditor";
import Combobox from "./Combobox";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Known labels for autocomplete */
  suggestedLabels?: string[];
  /** Known property keys for autocomplete */
  suggestedKeys?: string[];
};

export default function NodeForm({ open, onClose, onCreated, suggestedLabels = [], suggestedKeys = [] }: Props) {
  const [labels, setLabels] = useState<string[]>(["Supplier"]);
  const [labelInput, setLabelInput] = useState("");
  const [rows, setRows] = useState<EditableProperty[]>([
    { key: "id", type: "string", raw: "" },
    { key: "name", type: "string", raw: "" },
    { key: "status", type: "string", raw: "" },
    { key: "country", type: "string", raw: "" },
    { key: "active", type: "boolean", raw: "" },
  ]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const addLabel = (raw?: string) => {
    const trimmed = (raw ?? labelInput).trim();
    if (!trimmed) return;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      toast.error("La etiqueta debe coincidir con [A-Za-z_][A-Za-z0-9_]*");
      return;
    }
    if (!labels.includes(trimmed)) setLabels([...labels, trimmed]);
    setLabelInput("");
  };

  const removeLabel = (label: string) => {
    if (labels.length === 1) return;
    setLabels(labels.filter((l) => l !== label));
  };

  const submit = async () => {
    const { properties, errors } = buildTypedProperties(rows);
    if (errors.length > 0) {
      toast.error(`Propiedades: ${errors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
      return;
    }
    if (!properties.find((p) => p.key === "id")) {
      toast.error("El nodo necesita la propiedad `id` para enlazar relaciones");
      return;
    }
    setBusy(true);
    try {
      const created = await SupplyChainApi.createNode({ labels, properties });
      toast.success(`Creado ${created.labels.join(":")} ${(created.properties as Record<string, unknown>).id}`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Labels available to add (not already selected)
  const availableLabels = suggestedLabels.filter((l) => !labels.includes(l));

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl card-pad mt-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Crear nodo</h2>
            <p className="text-xs text-slate-500">
              Con 1 etiqueta = nodo simple · Con 2+ etiquetas = nodo multi-label
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Labels */}
        <div className="mb-5">
          <div className="label mb-1">
            Etiquetas{" "}
            <span className="text-[11px] text-slate-400 font-normal">
              (mínimo 1, añade más para multi-label)
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {labels.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 px-2.5 py-0.5 text-xs font-medium"
              >
                {l}
                {labels.length > 1 && (
                  <button
                    onClick={() => removeLabel(l)}
                    className="hover:text-rose-600 transition"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Combobox
                value={labelInput}
                onChange={setLabelInput}
                suggestions={availableLabels}
                placeholder="Añadir etiqueta (p. ej. Certified, Premium…)"
                className="input w-full"
              />
            </div>
            <button
              onClick={() => addLabel()}
              className="btn-secondary text-xs shrink-0"
            >
              <Plus size={13} /> Añadir
            </button>
          </div>
          {labels.length >= 2 && (
            <p className="text-[11px] text-brand-600 mt-1.5">
              ✓ Este nodo tendrá {labels.length} etiquetas: {labels.join(", ")}
            </p>
          )}
        </div>

        {/* Properties */}
        <div className="mb-4">
          <div className="label mb-1">
            Propiedades{" "}
            <span className="text-[11px] text-slate-400 font-normal">
              (se requieren 5+ para la rúbrica · include <code>id</code> obligatorio)
            </span>
          </div>
          <TypedPropertyEditor rows={rows} onChange={setRows} suggestedKeys={suggestedKeys} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Creando…" : "Crear nodo"}
          </button>
        </div>
      </div>
    </div>
  );
}
