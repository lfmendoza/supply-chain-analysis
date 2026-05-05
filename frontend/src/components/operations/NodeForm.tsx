import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { SupplyChainApi, asErrorMessage } from "../../api/client";
import TypedPropertyEditor, {
  buildTypedProperties,
  type EditableProperty,
} from "./TypedPropertyEditor";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function NodeForm({ open, onClose, onCreated }: Props) {
  const [labels, setLabels] = useState<string[]>(["Supplier"]);
  const [labelInput, setLabelInput] = useState("");
  const [rows, setRows] = useState<EditableProperty[]>([
    { key: "id", type: "string", raw: "" },
    { key: "name", type: "string", raw: "" },
  ]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const addLabel = () => {
    const trimmed = labelInput.trim();
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

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-6 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl card-pad mt-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Crear nodo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4">
          <div className="label mb-1">Etiquetas (una o más)</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {labels.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-xs font-medium"
              >
                {l}
                {labels.length > 1 && (
                  <button onClick={() => removeLabel(l)} className="hover:text-rose-600">
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLabel())}
              placeholder="Añadir etiqueta (p. ej. Certified)"
              className="input flex-1"
            />
            <button onClick={addLabel} className="btn-secondary text-xs">
              <Plus size={13} /> Añadir
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="label mb-1">Propiedades</div>
          <p className="text-[11px] text-slate-500 mb-2">
            Incluye <code>id</code> (texto) para hacer MATCH desde relaciones.
            Elige el tipo adecuado (Boolean, Date, DateTime, List y Point se mapean a tipos nativos Neo4j).
          </p>
          <TypedPropertyEditor rows={rows} onChange={setRows} />
        </div>

        <div className="flex items-center justify-end gap-2">
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
