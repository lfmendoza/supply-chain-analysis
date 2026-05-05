import { useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
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
  /** Known relationship types for autocomplete */
  suggestedTypes?: string[];
  /** Known node labels for autocomplete on start/end label fields */
  suggestedLabels?: string[];
};

export default function RelationshipForm({
  open,
  onClose,
  onCreated,
  suggestedTypes = [],
  suggestedLabels = [],
}: Props) {
  const [type, setType] = useState("SUMINISTRA");
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [startLabel, setStartLabel] = useState("");
  const [endLabel, setEndLabel] = useState("");
  const [rows, setRows] = useState<EditableProperty[]>([
    { key: "quantity", type: "float", raw: "" },
    { key: "unitCost", type: "float", raw: "" },
    { key: "since", type: "date", raw: "" },
  ]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!startId.trim() || !endId.trim() || !type.trim()) {
      toast.error("Tipo, id inicio e id fin son obligatorios");
      return;
    }
    const { properties, errors } = buildTypedProperties(rows);
    if (errors.length > 0) {
      toast.error(`Propiedades: ${errors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
      return;
    }
    if (properties.length < 3) {
      toast.error("La rúbrica requiere al menos 3 propiedades en la relación");
      return;
    }
    setBusy(true);
    try {
      await SupplyChainApi.createRelationship({
        startId: startId.trim(),
        endId: endId.trim(),
        type: type.trim(),
        startLabel: startLabel.trim() || undefined,
        endLabel: endLabel.trim() || undefined,
        properties,
      });
      toast.success(`Creado (${startId})-[:${type}]->(${endId})`);
      onCreated();
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Crear relación</h2>
            <p className="text-xs text-slate-500">
              Conecta dos nodos existentes con un tipo de relación y al menos 3 propiedades.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Type */}
        <div className="mb-4">
          <div className="label mb-1">Tipo de relación *</div>
          <Combobox
            value={type}
            onChange={setType}
            suggestions={suggestedTypes}
            placeholder="p. ej. SUMINISTRA, ALMACENA, PERTENECE_A…"
            className="input w-full"
          />
        </div>

        {/* Start / End */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="label mb-1">Nodo origen — id *</div>
            <input
              value={startId}
              onChange={(e) => setStartId(e.target.value)}
              className="input w-full"
              placeholder="p. ej. S1"
            />
          </div>
          <div>
            <div className="label mb-1">Nodo origen — etiqueta <span className="text-slate-400">(opc.)</span></div>
            <Combobox
              value={startLabel}
              onChange={setStartLabel}
              suggestions={suggestedLabels}
              placeholder="p. ej. Supplier"
              className="input w-full"
            />
          </div>
          <div>
            <div className="label mb-1">Nodo destino — id *</div>
            <input
              value={endId}
              onChange={(e) => setEndId(e.target.value)}
              className="input w-full"
              placeholder="p. ej. RM-A"
            />
          </div>
          <div>
            <div className="label mb-1">Nodo destino — etiqueta <span className="text-slate-400">(opc.)</span></div>
            <Combobox
              value={endLabel}
              onChange={setEndLabel}
              suggestions={suggestedLabels}
              placeholder="p. ej. RawMaterial"
              className="input w-full"
            />
          </div>
        </div>

        {/* Properties */}
        <div className="mb-4">
          <div className="label mb-1">
            Propiedades{" "}
            <span className="text-[11px] text-slate-400 font-normal">(mínimo 3 para la rúbrica)</span>
          </div>
          <TypedPropertyEditor rows={rows} onChange={setRows} />
        </div>

        {rows.length >= 3 && (
          <div className="mb-4 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
            ✓ {rows.filter((r) => r.key).length} propiedades definidas — cumple el requisito mínimo de la rúbrica.
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Creando…" : "Crear relación"}
          </button>
        </div>
      </div>
    </div>
  );
}
