import { Plus, Trash2 } from "lucide-react";
import type { PropertyType, TypedProperty } from "../../api/client";

const TYPES: PropertyType[] = [
  "string",
  "integer",
  "float",
  "boolean",
  "date",
  "datetime",
  "list",
  "point",
];

const TYPE_LABELS: Record<PropertyType, string> = {
  string: "texto",
  integer: "entero",
  float: "decimal",
  boolean: "booleano",
  date: "fecha",
  datetime: "fecha y hora",
  list: "lista",
  point: "punto",
};

export type EditableProperty = {
  key: string;
  type: PropertyType;
  raw: string;
};

export function buildTypedProperties(rows: EditableProperty[]): {
  properties: TypedProperty[];
  errors: { key: string; error: string }[];
} {
  const out: TypedProperty[] = [];
  const errors: { key: string; error: string }[] = [];
  for (const r of rows) {
    if (!r.key.trim()) continue;
    if (r.raw === "") continue;
    try {
      out.push({ key: r.key.trim(), type: r.type, value: parseRaw(r.raw, r.type) });
    } catch (err) {
      errors.push({ key: r.key, error: (err as Error).message });
    }
  }
  return { properties: out, errors };
}

function parseRaw(raw: string, t: PropertyType): unknown {
  switch (t) {
    case "string":
      return raw;
    case "integer": {
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new Error("no es un entero");
      return n;
    }
    case "float": {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error("no es un número");
      return n;
    }
    case "boolean": {
      const t = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
      if (["true", "1", "verdadero", "si"].includes(t)) return true;
      if (["false", "0", "falso", "no"].includes(t)) return false;
      throw new Error("valor booleano no reconocido (use verdadero/falso o sí/no)");
    }
    case "date":
      return raw.trim();
    case "datetime":
      return raw.trim();
    case "list":
      return raw.split(";").map((v) => v.trim()).filter(Boolean);
    case "point": {
      const m = raw.split(",").map((p) => p.trim());
      if (m.length !== 2) throw new Error("formato esperado: lat, lng");
      const lat = Number(m[0]);
      const lng = Number(m[1]);
      if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error("coordenadas no numéricas");
      return { latitude: lat, longitude: lng };
    }
  }
}

export default function TypedPropertyEditor({
  rows,
  onChange,
}: {
  rows: EditableProperty[];
  onChange: (rows: EditableProperty[]) => void;
}) {
  const update = (idx: number, patch: Partial<EditableProperty>) => {
    const next = rows.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const add = () => {
    onChange([...rows, { key: "", type: "string", raw: "" }]);
  };

  const remove = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-1.5">
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_120px_1fr_28px] gap-2 items-center">
          <input
            value={row.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            className="input"
            placeholder="clave"
          />
          <select
            value={row.type}
            onChange={(e) => update(idx, { type: e.target.value as PropertyType })}
            className="input"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            value={row.raw}
            onChange={(e) => update(idx, { raw: e.target.value })}
            className="input"
            placeholder={typeHint(row.type)}
          />
          <button
            onClick={() => remove(idx)}
            className="text-slate-400 hover:text-rose-600"
            title="Quitar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={add} className="btn-secondary text-xs mt-1">
        <Plus size={13} /> Añadir propiedad
      </button>
    </div>
  );
}

function typeHint(t: PropertyType): string {
  switch (t) {
    case "string":
      return "texto";
    case "integer":
      return "42";
    case "float":
      return "3,14 o 3.14";
    case "boolean":
      return "verdadero / falso";
    case "date":
      return "AAAA-MM-DD";
    case "datetime":
      return "AAAA-MM-DDTHH:MM:SSZ";
    case "list":
      return "v1; v2; v3";
    case "point":
      return "lat, lon";
  }
}
