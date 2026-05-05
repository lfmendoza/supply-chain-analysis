import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Layers, List, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { GraphNode, SupplyChainApi, asErrorMessage } from "../../api/client";
import ConfirmDialog from "../ConfirmDialog";
import NodeForm from "./NodeForm";
import NodeEditModal from "./NodeEditModal";
import BulkNodesPanel from "./BulkNodesPanel";

type Mode = "individual" | "masivo";
const PAGE_SIZES = [20, 50, 100, 200];

type Props = {
  labels: string[];
  onNavigateToCsv?: () => void;
};

export default function NodesTab({ labels, onNavigateToCsv }: Props) {
  const [mode, setMode] = useState<Mode>("individual");
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [skip, setSkip] = useState(0);
  const [items, setItems] = useState<GraphNode[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GraphNode | null>(null);
  const [editing, setEditing] = useState<GraphNode | null>(null);

  // Derive known property keys from currently loaded nodes (for typeahead)
  const suggestedKeys = useMemo(
    () => [...new Set(items.flatMap((n) => Object.keys(n.properties)))].sort(),
    [items]
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // fetch one extra to detect if there is a next page
      const r = await SupplyChainApi.listNodes({
        label: label || undefined,
        search: search || undefined,
        limit: limit + 1,
        skip,
      });
      setHasMore(r.items.length > limit);
      setItems(r.items.slice(0, limit));
    } catch (err) {
      setError(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [label, limit, skip, search]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, limit, skip]);

  const onDelete = async (node: GraphNode) => {
    setPendingDelete(null);
    try {
      const id = (node.properties as Record<string, unknown>).id as string | undefined;
      if (id) await SupplyChainApi.deleteNode(id, "id", true);
      else await SupplyChainApi.deleteNode(node.elementId, "elementId", true);
      toast.success("Nodo eliminado");
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSkip(0);
                  refresh();
                }
              }}
              placeholder="Buscar por id o nombre (Enter)"
              className="input pl-8 w-full"
            />
          </div>
          <select
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setSkip(0);
            }}
            className="input"
          >
            <option value="">Todas las etiquetas</option>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setSkip(0);
            }}
            className="input w-20"
            title="Tamaño de página"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button onClick={refresh} className="btn-secondary text-xs" disabled={busy}>
            <RefreshCw size={13} /> Actualizar
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs ml-auto">
            <Plus size={13} /> Crear nodo
          </button>
        </div>

        {/* Mode switch */}
        <div className="mt-2 flex items-center gap-2">
          <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-xs">
            <button
              onClick={() => setMode("individual")}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded transition ${
                mode === "individual" ? "bg-white text-brand-600 shadow-sm font-medium" : "text-slate-600"
              }`}
            >
              <List size={12} /> Individual
            </button>
            <button
              onClick={() => setMode("masivo")}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded transition ${
                mode === "masivo" ? "bg-white text-brand-600 shadow-sm font-medium" : "text-slate-600"
              }`}
            >
              <Layers size={12} /> Masivo
            </button>
          </div>
          {mode === "masivo" && (
            <span className="text-[11px] text-slate-500">
              Actualizar / eliminar propiedades en múltiples nodos a la vez
            </span>
          )}
        </div>

        {error && (
          <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
            {error}
          </div>
        )}
      </div>

      {mode === "individual" ? (
        <>
          <div className="card overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>{busy ? "Cargando…" : `${items.length} nodos`}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSkip(Math.max(0, skip - limit))}
                  disabled={skip === 0 || busy}
                  className="btn-secondary text-[11px] px-1.5 py-0.5"
                  title="Página anterior"
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="text-[11px] text-slate-500 min-w-[70px] text-center">
                  {skip + 1}–{skip + items.length}
                </span>
                <button
                  onClick={() => setSkip(skip + limit)}
                  disabled={!hasMore || busy}
                  className="btn-secondary text-[11px] px-1.5 py-0.5"
                  title="Página siguiente"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="border-b border-slate-200">
                    <Th>Etiquetas</Th>
                    <Th>id / nombre</Th>
                    <Th>Propiedades</Th>
                    <Th>Acciones</Th>
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
                            <span key={l} className="pill-info mr-1 mb-0.5">
                              {l}
                            </span>
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditing(n)}
                              className="text-brand-600 hover:text-brand-700"
                              title="Gestionar propiedades (agregar / actualizar / eliminar)"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setPendingDelete(n)}
                              className="text-rose-600 hover:text-rose-700"
                              title="Eliminar nodo con relaciones (DETACH DELETE)"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && !busy && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                        No hay nodos con estos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <NodeEditModal node={editing} onClose={() => setEditing(null)} onUpdated={refresh} suggestedKeys={suggestedKeys} />
        </>
      ) : (
        <BulkNodesPanel labels={labels} suggestedKeys={suggestedKeys} onNavigateToCsv={onNavigateToCsv} />
      )}

      <NodeForm open={showCreate} onClose={() => setShowCreate(false)} onCreated={refresh} suggestedLabels={labels} suggestedKeys={suggestedKeys} />
      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar este nodo?"
        description={`Se hará DETACH DELETE del nodo (y de todas sus relaciones).${
          pendingDelete ? `\nEtiquetas: ${pendingDelete.labels.join(":")}` : ""
        }`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => pendingDelete && onDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-1.5 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">
      {children}
    </th>
  );
}

function PropertiesInline({ props }: { props: Record<string, unknown> }) {
  const entries = Object.entries(props).filter(([k]) => k !== "id" && k !== "name");
  if (entries.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 6).map(([k, v]) => (
        <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
          <span className="text-slate-500">{k}:</span> {fmt(v)}
        </span>
      ))}
      {entries.length > 6 && (
        <span className="text-[11px] text-slate-500">+{entries.length - 6} más</span>
      )}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 30 ? s.slice(0, 28) + "…" : s;
}
