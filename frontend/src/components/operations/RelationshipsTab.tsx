import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, RefreshCw, Shuffle, Trash2 } from "lucide-react";
import { GraphRelationship, SupplyChainApi, asErrorMessage } from "../../api/client";
import ConfirmDialog from "../ConfirmDialog";
import RelationshipForm from "./RelationshipForm";

type Props = {
  relationshipTypes: string[];
};

export default function RelationshipsTab({ relationshipTypes }: Props) {
  const [type, setType] = useState<string>("");
  const [items, setItems] = useState<GraphRelationship[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GraphRelationship | null>(null);
  const [rewireOpen, setRewireOpen] = useState<GraphRelationship | null>(null);

  const params = useMemo(() => ({ type: type || undefined, limit: 200 }), [type]);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await SupplyChainApi.listRelationships(params);
      setItems(r.items);
    } catch (err) {
      setError(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const onDelete = async (rel: GraphRelationship) => {
    setPendingDelete(null);
    try {
      await SupplyChainApi.deleteRelationship(rel.elementId);
      toast.success("Relationship deleted");
      refresh();
    } catch (err) {
      toast.error(asErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="card-pad">
        <div className="flex flex-wrap items-center gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            <option value="">All relationship types</option>
            {relationshipTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button onClick={refresh} className="btn-secondary text-xs" disabled={busy}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs ml-auto">
            <Plus size={13} /> Create relationship
          </button>
        </div>
        {error && (
          <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
            {error}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
          {busy ? "Loading..." : `${items.length} relationships`}
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <Th>Type</Th>
                <Th>Path</Th>
                <Th>Properties</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.elementId} className="border-b border-slate-100 hover:bg-slate-50/40">
                  <td className="px-3 py-1.5 align-top">
                    <span className="pill-info">{r.type}</span>
                  </td>
                  <td className="px-3 py-1.5 align-top text-slate-800">
                    <div className="text-sm">
                      <span className="font-medium">{r.startId ?? "?"}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="font-medium">{r.endId ?? "?"}</span>
                    </div>
                    {r.startLabel && r.endLabel && (
                      <div className="text-[11px] text-slate-500">{r.startLabel} → {r.endLabel}</div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 align-top text-[11px] text-slate-700 max-w-[360px]">
                    <PropertiesInline props={r.properties} />
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRewireOpen(r)}
                        className="text-amber-600 hover:text-amber-700"
                        title="Rewire"
                      >
                        <Shuffle size={14} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(r)}
                        className="text-rose-600 hover:text-rose-700"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !busy && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                    No relationships of this type.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RelationshipForm open={showForm} onClose={() => setShowForm(false)} onCreated={refresh} />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete relationship?"
        description={
          pendingDelete
            ? `Delete the (${pendingDelete.startId ?? "?"})-[:${pendingDelete.type}]->(${pendingDelete.endId ?? "?"}) edge?`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && onDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
      <RewireDialog
        rel={rewireOpen}
        onClose={() => setRewireOpen(null)}
        onDone={() => {
          setRewireOpen(null);
          refresh();
        }}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-1.5 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">{children}</th>;
}

function PropertiesInline({ props }: { props: Record<string, unknown> }) {
  const entries = Object.entries(props);
  if (entries.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 4).map(([k, v]) => (
        <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
          <span className="text-slate-500">{k}:</span> {String(v)}
        </span>
      ))}
      {entries.length > 4 && (
        <span className="text-[11px] text-slate-500">+{entries.length - 4} more</span>
      )}
    </div>
  );
}

function RewireDialog({
  rel,
  onClose,
  onDone,
}: {
  rel: GraphRelationship | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newType, setNewType] = useState("");
  const [newStartId, setNewStartId] = useState("");
  const [newEndId, setNewEndId] = useState("");
  const [flip, setFlip] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!rel) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await SupplyChainApi.rewireRelationship(rel.elementId, {
        newType: newType.trim() || undefined,
        newStartId: newStartId.trim() || undefined,
        newEndId: newEndId.trim() || undefined,
        flipDirection: flip,
      });
      toast.success("Relationship rewired");
      onDone();
    } catch (err) {
      toast.error(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-6" onClick={onClose}>
      <div className="card-pad w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Rewire relationship</h3>
        <p className="text-xs text-slate-500 mb-4">
          Neo4j cannot mutate the type, direction or endpoints of an existing edge. The backend
          re-creates a copy with the new wiring (preserving properties) and deletes the original
          atomically.
        </p>
        <div className="space-y-2 text-xs">
          <Field label={`Original: (${rel.startId})-[:${rel.type}]->(${rel.endId})`}>
            <span className="text-slate-400">read-only</span>
          </Field>
          <Field label="New type (blank to keep)">
            <input value={newType} onChange={(e) => setNewType(e.target.value)} className="input w-full" placeholder={rel.type} />
          </Field>
          <Field label="New start id (blank to keep)">
            <input value={newStartId} onChange={(e) => setNewStartId(e.target.value)} className="input w-full" placeholder={rel.startId} />
          </Field>
          <Field label="New end id (blank to keep)">
            <input value={newEndId} onChange={(e) => setNewEndId(e.target.value)} className="input w-full" placeholder={rel.endId} />
          </Field>
          <label className="inline-flex items-center gap-1.5 mt-2">
            <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} className="accent-brand-600" />
            Flip direction
          </label>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Rewiring..." : "Rewire"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <div className="text-slate-500 mb-0.5">{label}</div>
      {children}
    </label>
  );
}
