import { useEffect, useState } from "react";
import { Boxes, GitFork, UploadCloud } from "lucide-react";
import PageHeader from "../components/PageHeader";
import NodesTab from "../components/operations/NodesTab";
import RelationshipsTab from "../components/operations/RelationshipsTab";
import CsvUploadTab from "../components/operations/CsvUploadTab";
import { SupplyChainApi } from "../api/client";

type Tab = "nodes" | "relationships" | "csv";

const TABS: { id: Tab; label: string; Icon: typeof Boxes }[] = [
  { id: "nodes", label: "Nodes", Icon: Boxes },
  { id: "relationships", label: "Relationships", Icon: GitFork },
  { id: "csv", label: "CSV Upload", Icon: UploadCloud },
];

export default function OperationsLab() {
  const [tab, setTab] = useState<Tab>("nodes");
  const [labels, setLabels] = useState<string[]>([]);
  const [relTypes, setRelTypes] = useState<string[]>([]);

  useEffect(() => {
    SupplyChainApi.listLabels().then(setLabels).catch(() => {});
    SupplyChainApi.listRelationshipTypes().then(setRelTypes).catch(() => {});
  }, [tab]);

  return (
    <div>
      <PageHeader
        title="Graph Operations Lab"
        description="Hands-on demonstration of the rubric criteria 4, 9–19: create nodes (multi-label and any datatype), create relationships, update or remove properties, rewire edges, delete elements, and bulk-load through CSV."
        badge={<span className="pill-info">CRUD + CSV</span>}
      />

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.Icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "nodes" && <NodesTab labels={labels} />}
      {tab === "relationships" && <RelationshipsTab relationshipTypes={relTypes} />}
      {tab === "csv" && <CsvUploadTab />}
    </div>
  );
}
