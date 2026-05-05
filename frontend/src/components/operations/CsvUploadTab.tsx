import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import { Download, FileUp, Sparkles, UploadCloud } from "lucide-react";
import {
  CsvTemplate,
  CsvUploadResult,
  PropertyType,
  SupplyChainApi,
  asErrorMessage,
} from "../../api/client";

type CsvKind = "nodes" | "relationships";

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

export default function CsvUploadTab() {
  const [templates, setTemplates] = useState<{ nodes: CsvTemplate[]; relationships: CsvTemplate[] } | null>(
    null
  );
  const [kind, setKind] = useState<CsvKind>("nodes");
  const [selectedTemplate, setSelectedTemplate] = useState<CsvTemplate | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(
    null
  );
  const [columnTypes, setColumnTypes] = useState<Record<string, PropertyType>>({});
  const [pointMappings, setPointMappings] = useState<{ key: string; latitudeColumn: string; longitudeColumn: string }[]>([]);

  // node-only fields
  const [label, setLabel] = useState("");
  const [idColumn, setIdColumn] = useState("id");

  // relationship-only fields
  const [relType, setRelType] = useState("");
  const [fromColumn, setFromColumn] = useState("from");
  const [toColumn, setToColumn] = useState("to");
  const [fromLabel, setFromLabel] = useState("");
  const [toLabel, setToLabel] = useState("");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CsvUploadResult | null>(null);

  useEffect(() => {
    SupplyChainApi.csvTemplates()
      .then((r) => setTemplates({ nodes: r.nodes, relationships: r.relationships }))
      .catch((err) => toast.error(asErrorMessage(err)));
  }, []);

  const allTemplates = useMemo(() => {
    if (!templates) return [];
    return kind === "nodes" ? templates.nodes : templates.relationships;
  }, [templates, kind]);

  const applyTemplate = (tpl: CsvTemplate) => {
    setSelectedTemplate(tpl);
    if (kind === "nodes") {
      setLabel(tpl.label ?? "");
      setIdColumn(tpl.idColumn ?? "id");
    } else {
      setRelType(tpl.relationshipType ?? "");
      setFromColumn(tpl.fromColumn ?? "from");
      setToColumn(tpl.toColumn ?? "to");
      setFromLabel(tpl.fromLabel ?? "");
      setToLabel(tpl.toLabel ?? "");
    }
    const types: Record<string, PropertyType> = {};
    for (const c of tpl.columns) types[c.name] = c.type as PropertyType;
    setColumnTypes(types);
    setPointMappings(tpl.pointColumns ?? []);
  };

  const handleFile = (f: File | null) => {
    setCsvFile(f);
    setPreview(null);
    setResult(null);
    if (!f) return;
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      preview: 6,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        setPreview({ headers, rows: results.data });
        setColumnTypes((prev) => {
          const next: Record<string, PropertyType> = { ...prev };
          for (const h of headers) {
            if (!(h in next)) next[h] = "string";
          }
          return next;
        });
      },
      error: (err) => toast.error(`Error al leer CSV: ${err.message}`),
    });
  };

  const submit = async () => {
    if (!csvFile) {
      toast.error("Elige un archivo CSV");
      return;
    }
    const form = new FormData();
    form.append("file", csvFile);
    form.append("columnTypes", JSON.stringify(columnTypes));
    if (kind === "nodes") {
      if (!label.trim()) {
        toast.error("La etiqueta del nodo es obligatoria");
        return;
      }
      form.append("label", label.trim());
      form.append("idColumn", idColumn || "id");
      form.append("pointColumns", JSON.stringify(pointMappings));
    } else {
      if (!relType.trim()) {
        toast.error("El tipo de relación es obligatorio");
        return;
      }
      form.append("type", relType.trim());
      form.append("fromColumn", fromColumn);
      form.append("toColumn", toColumn);
      if (fromLabel.trim()) form.append("fromLabel", fromLabel.trim());
      if (toLabel.trim()) form.append("toLabel", toLabel.trim());
    }
    setBusy(true);
    setResult(null);
    try {
      const res =
        kind === "nodes"
          ? await SupplyChainApi.uploadNodesCsv(form)
          : await SupplyChainApi.uploadRelationshipsCsv(form);
      setResult(res);
      toast.success(`Se importaron ${res.written} de ${res.processed} filas`);
    } catch (err) {
      toast.error(asErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-pad">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <UploadCloud size={14} /> Subir CSV
          </h3>
          <KindSwitch kind={kind} onChange={setKind} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="md:col-span-2">
            <div className="label mb-1">Archivo CSV</div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <div>
            <div className="label mb-1">Plantilla rápida</div>
            <select
              value={selectedTemplate?.name ?? ""}
              onChange={(e) => {
                const tpl = allTemplates.find((t) => t.name === e.target.value);
                if (tpl) applyTemplate(tpl);
              }}
              className="input w-full"
            >
              <option value="">Elegir plantilla (opcional)</option>
              {allTemplates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTemplate?.downloadPath && (
              <a
                href={`/${selectedTemplate.downloadPath}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-600 hover:underline"
              >
                <Download size={11} /> Abrir ejemplo
              </a>
            )}
          </div>
        </div>

        {kind === "nodes" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <Field label="Etiqueta del nodo *">
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="input w-full" placeholder="Proveedor" />
            </Field>
            <Field label="Columna id">
              <input value={idColumn} onChange={(e) => setIdColumn(e.target.value)} className="input w-full" />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <Field label="Tipo de relación *">
              <input value={relType} onChange={(e) => setRelType(e.target.value)} className="input w-full" placeholder="SUMINISTRA" />
            </Field>
            <Field label="Columna origen">
              <input value={fromColumn} onChange={(e) => setFromColumn(e.target.value)} className="input w-full" />
            </Field>
            <Field label="Columna destino">
              <input value={toColumn} onChange={(e) => setToColumn(e.target.value)} className="input w-full" />
            </Field>
            <Field label="Etiqueta origen (opcional)">
              <input value={fromLabel} onChange={(e) => setFromLabel(e.target.value)} className="input w-full" />
            </Field>
            <Field label="Etiqueta destino (opcional)">
              <input value={toLabel} onChange={(e) => setToLabel(e.target.value)} className="input w-full" />
            </Field>
          </div>
        )}

        {preview && (
          <PreviewTable
            preview={preview}
            columnTypes={columnTypes}
            onChangeColumnType={(col, t) => setColumnTypes((prev) => ({ ...prev, [col]: t }))}
          />
        )}

        {kind === "nodes" && pointMappings.length > 0 && (
          <div className="mt-3 p-2.5 rounded bg-sky-50 border border-sky-200 text-xs text-sky-800 flex items-center gap-2">
            <Sparkles size={13} />
            Punto geográfico detectado: {pointMappings.map((p) => `${p.key}=(${p.latitudeColumn}, ${p.longitudeColumn})`).join(", ")}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Las filas se envían en un lote UNWIND transaccional. Valores de lista separados con <code>;</code>.
          </p>
          <button onClick={submit} disabled={busy || !csvFile} className="btn-primary text-sm">
            <FileUp size={14} />
            {busy ? "Subiendo…" : "Subir a Neo4j"}
          </button>
        </div>
      </div>

      {result && <ResultCard result={result} />}
    </div>
  );
}

function KindSwitch({ kind, onChange }: { kind: CsvKind; onChange: (k: CsvKind) => void }) {
  return (
    <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-xs">
      <button
        onClick={() => onChange("nodes")}
        className={`px-2.5 py-1 rounded ${kind === "nodes" ? "bg-white text-brand-600 shadow-sm" : "text-slate-600"}`}
      >
        Nodos
      </button>
      <button
        onClick={() => onChange("relationships")}
        className={`px-2.5 py-1 rounded ${kind === "relationships" ? "bg-white text-brand-600 shadow-sm" : "text-slate-600"}`}
      >
        Relaciones
      </button>
    </div>
  );
}

function PreviewTable({
  preview,
  columnTypes,
  onChangeColumnType,
}: {
  preview: { headers: string[]; rows: Record<string, string>[] };
  columnTypes: Record<string, PropertyType>;
  onChangeColumnType: (col: string, t: PropertyType) => void;
}) {
  return (
    <div className="rounded border border-slate-200 overflow-auto max-h-[280px]">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            {preview.headers.map((h) => (
              <th key={h} className="px-2 py-1 text-left font-semibold text-slate-600 border-b border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <span>{h}</span>
                  <select
                    value={columnTypes[h] ?? "string"}
                    onChange={(e) => onChangeColumnType(h, e.target.value as PropertyType)}
                    className="rounded border border-slate-200 px-1 py-0.5 font-normal text-slate-600"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              {preview.headers.map((h) => (
                <td key={h} className="px-2 py-1 text-slate-700 max-w-[200px] truncate">
                  {row[h] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCard({ result }: { result: CsvUploadResult }) {
  return (
    <div className="card-pad">
      <h3 className="text-sm font-semibold text-slate-700">Resultado de la subida</h3>
      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <Stat label="Procesadas" value={result.processed} />
        <Stat label="Importadas" value={result.written} />
        <Stat label="Tiempo" value={`${result.elapsedMs.toFixed(0)} ms`} />
      </div>
      {result.errors.length > 0 && (
        <div className="mt-3 max-h-[160px] overflow-auto">
          <div className="text-xs font-semibold text-rose-700 mb-1">Errores ({result.errors.length})</div>
          <ul className="text-xs text-rose-700 space-y-0.5">
            {result.errors.slice(0, 25).map((e, i) => (
              <li key={i}>
                {e.row ? `fila ${e.row}` : ""} {e.column ? `· ${e.column}` : ""}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.sampleRow && (
        <div className="mt-3 text-xs">
          <div className="text-slate-500 mb-1">Fila de ejemplo enviada a Neo4j:</div>
          <pre className="bg-slate-50 rounded p-2 overflow-auto max-h-[160px] text-[11px]">
            {JSON.stringify(result.sampleRow, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs">
      <div className="text-slate-500 mb-0.5">{label}</div>
      {children}
    </label>
  );
}
