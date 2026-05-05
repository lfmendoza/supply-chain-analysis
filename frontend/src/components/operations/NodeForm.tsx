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
      toast.error("Label must match [A-Za-z_][A-Za-z0-9_]*");
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
      toast.error(`Property errors: ${errors.map((e) => `${e.key}: ${e.error}`).join("; ")}`);
      return;
    }
    if (!properties.find((p) => p.key === "id")) {
      toast.error("Node needs an `id` property to be linkable later");
      return;
    }
    setBusy(true);
    try {
      const created = await SupplyChainApi.createNode({ labels, properties });
      toast.success(`Created ${created.labels.join(":")} ${(created.properties as Record<string, unknown>).id}`);
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
          <h2 className="text-lg font-semibold text-slate-900">Create node</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4">
          <div className="label mb-1">Labels (1 or more)</div>
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
              placeholder="Add another label (e.g. Audited)"
              className="input flex-1"
            />
            <button onClick={addLabel} className="btn-secondary text-xs">
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="label mb-1">Properties</div>
          <p className="text-[11px] text-slate-500 mb-2">
            Provide an <code>id</code> string property — used to MATCH the node from relationships.
            Choose the right type for each value (Boolean, Date, DateTime, List and Point all map to
            native Neo4j types).
          </p>
          <TypedPropertyEditor rows={rows} onChange={setRows} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Creating..." : "Create node"}
          </button>
        </div>
      </div>
    </div>
  );
}
