import { Info } from "lucide-react";
import type { ElementSelection } from "./GraphCytoscape";
import { LABEL_COLORS } from "./graphStyles";

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

type Props = {
  selection: ElementSelection;
};

export default function PropertyPanel({ selection }: Props) {
  return (
    <div className="card-pad">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
        <Info size={14} /> Selección
      </h3>
      {!selection && (
        <p className="text-xs text-slate-500 mt-2">
          Haz clic en un nodo o una relación del grafo para ver sus propiedades.
        </p>
      )}
      {selection?.kind === "node" && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-block rounded-full"
              style={{
                backgroundColor: LABEL_COLORS[selection.data.label] ?? "#94a3b8",
                width: 12,
                height: 12,
              }}
            />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">{selection.data.label}</div>
              <div className="text-base font-semibold text-slate-900 leading-tight">
                {selection.data.name ?? selection.data.id}
              </div>
              <div className="text-xs text-slate-500">id: {selection.data.id}</div>
            </div>
          </div>
          <PropertyTable data={selection.data} skip={["label", "name", "id"]} />
        </div>
      )}
      {selection?.kind === "edge" && (
        <div className="mt-2 space-y-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Relación</div>
            <div className="text-base font-semibold text-slate-900 leading-tight">
              {selection.data.relType}
            </div>
            <div className="text-xs text-slate-500">
              {selection.data.source} → {selection.data.target}
            </div>
          </div>
          <PropertyTable
            data={selection.data}
            skip={["id", "source", "target", "relType"]}
          />
        </div>
      )}
    </div>
  );
}

function PropertyTable({
  data,
  skip,
}: {
  data: Record<string, unknown>;
  skip: string[];
}) {
  const entries = Object.entries(data).filter(([key]) => !skip.includes(key));
  if (entries.length === 0) {
    return <p className="text-xs text-slate-500">No hay propiedades adicionales.</p>;
  }
  return (
    <table className="w-full text-xs">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-t border-slate-100">
            <td className="py-1 pr-2 text-slate-500 align-top">{k}</td>
            <td className="py-1 text-slate-800 break-all">{formatValue(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
