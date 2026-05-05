import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Layers, List, Pencil, Plus, RefreshCw, Shuffle, Trash2 } from "lucide-react";
import { GraphRelationship, SupplyChainApi, asErrorMessage } from "../../api/client";
import ConfirmDialog from "../ConfirmDialog";
import RelationshipForm from "./RelationshipForm";
import RelEditModal from "./RelEditModal";
import BulkRelsPanel from "./BulkRelsPanel";

type Mode = "individual" | "masivo";
const PAGE_SIZES = [20, 50, 100, 200];

type Props = {
  relationshipTypes: string[];
};

export default function RelationshipsTab({ relationshipTypes }: Props) {
  const [mode, setMode] = useState<Mode>("individual");
  const [type, setType] = useState("");
  const [limit, setLimit] = useState(50);
  const [skip, setSkip] = useState(0);
  const [items, setItems] = useState<GraphRelationship[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GraphRelationship | null>(null);
  const [editing, setEditing] = useState<GraphRelationship | null>(null);
  const [rewireOpen, setRewireOpen] = useState<GraphRelationship | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await SupplyChainApi.listRelationships({
        type: type || undefined,
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
  }, [type, limit, skip]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, limit, skip]);

  const onDelete = async (rel: GraphRelationship) => {
    setPendingDelete(null);
    try {
      await SupplyChainApi.deleteRelationship(rel.elementId);
      toast.success("Relación eliminada");
      refresh();
    } catch (err) {
      toast.error(asErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="card-pad">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setSkip(0);
            }}
            className="input"
          >
            <option value="">Todos los tipos</option>
            {relationshipTypes.map((t) => (
              <option key={t} value={t}>
                {t}
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
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs ml-auto">
            <Plus size={13} /> Crear relación
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
              Actualizar / eliminar propiedades en múltiples relaciones a la vez
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
              <span>{busy ? "Cargando…" : `${items.length} relaciones`}</span>
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
                    <Th>Tipo</Th>
                    <Th>Camino</Th>
                    <Th>Propiedades</Th>
                    <Th>Acciones</Th>
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
                          <div className="text-[11px] text-slate-500">
                            {r.startLabel} → {r.endLabel}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 align-top text-[11px] text-slate-700 max-w-[360px]">
                        <PropertiesInline props={r.properties} />
                      </td>
                      <td className="px-3 py-1.5 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditing(r)}
                            className="text-brand-600 hover:text-brand-700"
                            title="Gestionar propiedades (agregar / actualizar / eliminar)"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setRewireOpen(r)}
                            className="text-amber-600 hover:text-amber-700"
                            title="Reconectar (cambiar tipo, dirección o extremos)"
                          >
                            <Shuffle size={14} />
                          </button>
                          <button
                            onClick={() => setPendingDelete(r)}
                            className="text-rose-600 hover:text-rose-700"
                            title="Eliminar relación"
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
                        No hay relaciones de este tipo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <RelEditModal rel={editing} onClose={() => setEditing(null)} onUpdated={refresh} />
        </>
      ) : (
        <BulkRelsPanel relationshipTypes={relationshipTypes} />
      )}

      <RelationshipForm open={showForm} onClose={() => setShowForm(false)} onCreated={refresh} />
      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar la relación?"
        description={
          pendingDelete
            ? `¿Eliminar (${pendingDelete.startId ?? "?"})-[:${pendingDelete.type}]->(${pendingDelete.endId ?? "?"})?`
            : undefined
        }
        confirmLabel="Eliminar"
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
  return (
    <th className="px-3 py-1.5 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">
      {children}
    </th>
  );
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
        <span className="text-[11px] text-slate-500">+{entries.length - 4} más</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RewireDialog (unchanged logic, just co-located here)
// ---------------------------------------------------------------------------

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
      toast.success("Relación reconectada");
      onDone();
    } catch (err) {
      toast.error(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-6"
      onClick={onClose}
    >
      <div className="card-pad w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Reconectar relación</h3>
        <p className="text-xs text-slate-500 mb-4">
          Neo4j no permite cambiar in situ el tipo, la dirección ni los extremos. El backend recrea la arista con el
          nuevo cableado (conservando propiedades) y borra la original en la misma operación.
        </p>
        <div className="space-y-2 text-xs">
          <Field label={`Original: (${rel.startId})-[:${rel.type}]->(${rel.endId})`}>
            <span className="text-slate-400">solo lectura</span>
          </Field>
          <Field label="Nuevo tipo (vacío = mantener)">
            <input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="input w-full"
              placeholder={rel.type}
            />
          </Field>
          <Field label="Nuevo id inicio (vacío = mantener)">
            <input
              value={newStartId}
              onChange={(e) => setNewStartId(e.target.value)}
              className="input w-full"
              placeholder={rel.startId}
            />
          </Field>
          <Field label="Nuevo id fin (vacío = mantener)">
            <input
              value={newEndId}
              onChange={(e) => setNewEndId(e.target.value)}
              className="input w-full"
              placeholder={rel.endId}
            />
          </Field>
          <label className="inline-flex items-center gap-1.5 mt-2">
            <input
              type="checkbox"
              checked={flip}
              onChange={(e) => setFlip(e.target.checked)}
              className="accent-brand-600"
            />
            Invertir dirección
          </label>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Reconectando…" : "Reconectar"}
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
