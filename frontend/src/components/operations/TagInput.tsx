import { KeyboardEvent, useState } from "react";
import { X } from "lucide-react";
import Combobox from "./Combobox";

type Props = {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
};

/**
 * Tag-based input: type a value + Enter (or comma) to add it as a removable chip.
 * Optionally shows a typeahead dropdown from `suggestions`.
 */
export default function TagInput({ value, onChange, suggestions = [], placeholder = "Escribe y presiona Enter" }: Props) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const trimmed = raw.trim().replace(/,+$/, "");
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraft("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] px-2 py-1.5 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-800 px-2 py-0.5 text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="hover:text-rose-600 transition"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {suggestions.length > 0 ? (
        <div className="flex-1 min-w-[120px]">
          <Combobox
            value={draft}
            onChange={(v) => {
              setDraft(v);
              if (v.endsWith(",")) add(v);
            }}
            suggestions={suggestions.filter((s) => !value.includes(s))}
            placeholder={value.length === 0 ? placeholder : "Añadir otra…"}
            className="border-none outline-none shadow-none ring-0 focus:ring-0 bg-transparent text-sm w-full p-0"
          />
        </div>
      ) : (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : "Añadir otra…"}
          className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm"
        />
      )}
    </div>
  );
}
