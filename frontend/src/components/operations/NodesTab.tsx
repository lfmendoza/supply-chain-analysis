import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { GraphNode, SupplyChainApi, asErrorMessage } from "../../api/client";
import ConfirmDialog from "../ConfirmDialog";
import NodeForm from "./NodeForm";

type Props = {
  labels: string[];
};

export default function NodesTab({ labels }: Props) {
  const [label, setLabel] = useState<string>("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<GraphNode[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GraphNode | null>(null);

  const loadable = useMemo(() => ({ label: label || undefined, search: search || undefined }), [label, search]);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await SupplyChainApi.listNodes({ ...loadable, limit: 200 });
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
  }, [label]);

  const onDelete = async (node: GraphNode) => {
    setPendingDelete(null);
    try {
      const id = (node.properties as Record<string, unknown>).id as string | undefined;
      if (id) {
        await SupplyChainApi.deleteNode(id, "id", true);
      } else {
        await SupplyChainApi.deleteNode(node.elementId, "elementId", true);
      }
      toast.success("Node deleted");
      refresh();
    } catch (err) {
      toast.error(asErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="card-pad">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
              placeholder="Search by id or name (Enter to search)"
              className="input pl-8 w-full"
            />
          </div>
          <select value={label} onChange={(e) => setLabel(e.target.value)} className="input">
            <option value="">All labels</option>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button onClick={refresh} className="btn-secondary text-xs" disabled={busy}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs ml-auto">
            <Plus size={13} /> Create node
          </button>
        </div>
        {error && (
          <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
            {error}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
          <span>{busy ? "Loading..." : `${items.length} nodes`}</span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <Th>Labels</Th>
                <Th>id / name</Th>
                <Th>Properties</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => {
                const id = (n.properties as Record<string, unknown>).id as string | undefined;
                const name = (n.properties as Record<string, unknown>).name as string | undefined;
                return (
                  <tr key={n.elementId} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-3 py-1.5 align-top">
                      {n.labels.map((l) => (
                        <span key={l} className="pill-info mr-1 mb-0.5">{l}</span>
                      ))}
                    </td>
                    <td className="px-3 py-1.5 align-top text-slate-800">
                      <div className="font-medium">{name ?? id ?? "—"}</div>
                      {id && <div className="text-[11px] text-slate-500">id: {id}</div>}
                    </td>
                    <td className="px-3 py-1.5 align-top text-[11px] text-slate-700 max-w-[420px]">
                      <PropertiesInline props={n.properties} />
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <button
                        onClick={() => setPendingDelete(n)}
                        className="text-rose-600 hover:text-rose-700"
                        title="Delete with relationships"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !busy && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                    No nodes match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NodeForm open={showForm} onClose={() => setShowForm(false)} onCreated={refresh} />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this node?"
        description={`This will DETACH-DELETE the node (also removing any of its relationships).${
          pendingDelete ? `\nLabels: ${pendingDelete.labels.join(":")}` : ""
        }`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && onDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-1.5 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">{children}</th>;
}

function PropertiesInline({ props }: { props: Record<string, unknown> }) {
  const entries = Object.entries(props).filter(([k]) => k !== "id" && k !== "name");
  if (entries.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 6).map(([k, v]) => (
        <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
          <span className="text-slate-500">{k}:</span> {format(v)}
        </span>
      ))}
      {entries.length > 6 && (
        <span className="text-[11px] text-slate-500">+{entries.length - 6} more</span>
      )}
    </div>
  );
}

function format(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 30 ? s.slice(0, 28) + "..." : s;
}
