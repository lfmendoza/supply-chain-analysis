import { useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
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

export default function RelationshipForm({ open, onClose, onCreated }: Props) {
  const [type, setType] = useState("SUPPLIES");
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [startLabel, setStartLabel] = useState("");
  const [endLabel, setEndLabel] = useState("");
  const [rows, setRows] = useState<EditableProperty[]>([]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!startId.trim() || !endId.trim() || !type.trim()) {
      toast.error("type, startId and endId are required");
      return;
    }
    const { properties, errors } = buildTypedProperties(rows);
    if (errors.length > 0) {
      toast.error(`Property errors: ${errors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
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
      toast.success(`Created (${startId})-[:${type}]->(${endId})`);
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
          <h2 className="text-lg font-semibold text-slate-900">Create relationship</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Type *">
            <input value={type} onChange={(e) => setType(e.target.value)} className="input w-full" />
          </Field>
          <div />
          <Field label="Start node id *">
            <input value={startId} onChange={(e) => setStartId(e.target.value)} className="input w-full" placeholder="e.g. S1" />
          </Field>
          <Field label="Start label (optional, for clarity)">
            <input value={startLabel} onChange={(e) => setStartLabel(e.target.value)} className="input w-full" placeholder="Supplier" />
          </Field>
          <Field label="End node id *">
            <input value={endId} onChange={(e) => setEndId(e.target.value)} className="input w-full" placeholder="e.g. RM-A" />
          </Field>
          <Field label="End label (optional)">
            <input value={endLabel} onChange={(e) => setEndLabel(e.target.value)} className="input w-full" placeholder="RawMaterial" />
          </Field>
        </div>

        <div className="mb-4">
          <div className="label mb-1">Relationship properties (typed)</div>
          <TypedPropertyEditor rows={rows} onChange={setRows} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Creating..." : "Create relationship"}
          </button>
        </div>
      </div>
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
