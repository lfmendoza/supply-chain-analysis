import { useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
};

/**
 * Controlled text input with a typeahead dropdown.
 * Allows free-form text in addition to picking from suggestions.
 */
export default function Combobox({ value, onChange, suggestions, placeholder, className = "input w-full" }: Props) {
  const [open, setOpen] = useState(false);

  const filtered = suggestions
    .filter((s) => !value || s.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 12);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={className}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 w-full mt-0.5 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-0.5">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm transition ${
                  value === s
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
