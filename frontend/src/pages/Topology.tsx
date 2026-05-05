import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { GraphSummary, SupplyChainApi, asErrorMessage } from "../api/client";
import GraphCytoscape, {
  type ElementSelection,
  type Highlights,
} from "../components/graph/GraphCytoscape";
import FilterPanel from "../components/graph/FilterPanel";
import PropertyPanel from "../components/graph/PropertyPanel";
import PageHeader from "../components/PageHeader";
import { ALL_LABELS } from "../components/graph/graphStyles";

const DEFAULT_LABELS = new Set([
  "Supplier",
  "RawMaterial",
  "Product",
  "Warehouse",
  "Customer",
  "Location",
  "Carrier",
  "Route",
]);

export default function Topology() {
  const [summary, setSummary] = useState<GraphSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabledLabels, setEnabledLabels] = useState<Set<string>>(DEFAULT_LABELS);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [selection, setSelection] = useState<ElementSelection>(null);
  const [highlights] = useState<Highlights>({});

  useEffect(() => {
    SupplyChainApi.graphSummary()
      .then(setSummary)
      .catch((e) => {
        const msg = asErrorMessage(e, "No se pudo cargar la topología");
        setError(msg);
        toast.error(msg);
      });
  }, []);

  const labelsPresent = useMemo(() => {
    if (!summary) return ALL_LABELS;
    const present = new Set<string>();
    for (const n of summary.nodes) present.add(n.label);
    return ALL_LABELS.filter((l) => present.has(l)).concat(
      [...present].filter((l) => !ALL_LABELS.includes(l))
    );
  }, [summary]);

  const counts = summary?.counts ?? {};
  const totalNodes = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalEdges = summary?.edges.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Topología del grafo"
        description="Vista Cytoscape del grafo Neo4j. Filtra por etiqueta, busca y haz clic en nodos o relaciones para ver propiedades."
        badge={
          summary ? (
            <span className="pill-info">
              {totalNodes.toLocaleString("es")} nodos · {totalEdges.toLocaleString("es")} relaciones
            </span>
          ) : null
        }
      />

      {error && (
        <div className="card-pad mb-4 border border-rose-200 bg-rose-50 text-rose-700 text-sm">
          No se pudo cargar el grafo: {error}. Comprueba que el backend está en marcha y Neo4j es accesible.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4">
        <FilterPanel
          availableLabels={labelsPresent}
          enabledLabels={enabledLabels}
          searchTerm={searchTerm}
          showEdgeLabels={showEdgeLabels}
          onToggleLabel={(label) => {
            setEnabledLabels((prev) => {
              const next = new Set(prev);
              if (next.has(label)) next.delete(label);
              else next.add(label);
              return next;
            });
          }}
          onSearchChange={setSearchTerm}
          onSelectAll={() => setEnabledLabels(new Set(labelsPresent))}
          onSelectNone={() => setEnabledLabels(new Set())}
          onToggleEdgeLabels={() => setShowEdgeLabels((v) => !v)}
        />

        {!summary ? (
          <div className="card flex items-center justify-center text-slate-500 text-sm" style={{ height: 620 }}>
            Cargando topología…
          </div>
        ) : (
          <GraphCytoscape
            nodes={summary.nodes}
            edges={summary.edges}
            enabledLabels={enabledLabels}
            searchTerm={searchTerm}
            highlights={highlights}
            showEdgeLabels={showEdgeLabels}
            onSelect={setSelection}
            height={620}
          />
        )}

        <PropertyPanel selection={selection} />
      </div>
    </div>
  );
}
