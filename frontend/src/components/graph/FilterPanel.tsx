import { Search, ToggleLeft, ToggleRight } from "lucide-react";
import { LABEL_COLORS } from "./graphStyles";

type Props = {
  availableLabels: string[];
  enabledLabels: Set<string>;
  searchTerm: string;
  showEdgeLabels: boolean;
  onToggleLabel: (label: string) => void;
  onSearchChange: (q: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onToggleEdgeLabels: () => void;
};

export default function FilterPanel({
  availableLabels,
  enabledLabels,
  searchTerm,
  showEdgeLabels,
  onToggleLabel,
  onSearchChange,
  onSelectAll,
  onSelectNone,
  onToggleEdgeLabels,
}: Props) {
  return (
    <div className="card-pad">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Filtros</h3>
        <div className="flex items-center gap-1 text-[11px]">
          <button onClick={onSelectAll} className="text-brand-600 hover:underline">
            Todos
          </button>
          <span className="text-slate-300">|</span>
          <button onClick={onSelectNone} className="text-slate-500 hover:underline">
            Ninguno
          </button>
        </div>
      </div>

      <label className="block">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por id o nombre"
            className="input pl-8 w-full"
          />
        </div>
      </label>

      <ul className="mt-3 space-y-1 max-h-[280px] overflow-y-auto pr-1">
        {availableLabels.map((label) => {
          const checked = enabledLabels.has(label);
          const color = LABEL_COLORS[label] ?? "#94a3b8";
          return (
            <li key={label}>
              <label
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer ${
                  checked ? "bg-slate-50" : "hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleLabel(label)}
                  className="accent-brand-600"
                />
                <span
                  className="inline-block rounded-full"
                  style={{ backgroundColor: color, width: 9, height: 9 }}
                />
                <span className={checked ? "text-slate-800" : "text-slate-500"}>{label}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <button
        onClick={onToggleEdgeLabels}
        className="mt-3 flex items-center gap-1.5 text-xs text-slate-600 hover:text-brand-600"
      >
        {showEdgeLabels ? <ToggleRight size={16} className="text-brand-600" /> : <ToggleLeft size={16} />}
        Mostrar tipo de relación
      </button>
    </div>
  );
}
