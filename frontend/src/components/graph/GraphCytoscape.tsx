import { useEffect, useMemo, useRef } from "react";
import cytoscape, {
  type Core,
  type ElementDefinition,
  type LayoutOptions,
} from "cytoscape";
import fcose from "cytoscape-fcose";
import type { TopologyEdge, TopologyNode } from "../../api/client";
import {
  cytoscapeStylesheet,
  fcoseLayoutOptions,
  LABEL_COLORS,
} from "./graphStyles";

cytoscape.use(fcose);

export type ElementSelection =
  | { kind: "node"; data: TopologyNode }
  | { kind: "edge"; data: TopologyEdge & { id: string } }
  | null;

export type Highlights = {
  /** Node ids to mark as `impact` (red, larger). */
  impactNodes?: Set<string>;
  /** Node ids to mark as `optimized` (green outline). */
  optimizedNodes?: Set<string>;
  /** Node ids to mark as `algo-top` (amber outline, used for algorithm rankings). */
  algoTopNodes?: Set<string>;
  /** Node ids that lie on a shortest path. */
  pathNodes?: Set<string>;
  /** Edge keys (`source->target:relType`) to highlight as `path-edge`. */
  pathEdgeKeys?: Set<string>;
  /** Edge keys to highlight as `impact-edge`. */
  impactEdgeKeys?: Set<string>;
};

export type GraphCytoscapeProps = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  enabledLabels?: Set<string>;
  searchTerm?: string;
  highlights?: Highlights;
  showEdgeLabels?: boolean;
  height?: number;
  onSelect?: (sel: ElementSelection) => void;
};

const edgeKey = (e: { source: string; target: string; relType: string }) =>
  `${e.source}->${e.target}:${e.relType}`;

function isInactive(n: TopologyNode): boolean {
  return Boolean(n.status && n.status !== "active" && n.status !== "open" && n.status !== "pending");
}
function isBlockedEdge(e: TopologyEdge): boolean {
  return Boolean(e.status && e.status !== "open" && e.status !== "active");
}

export default function GraphCytoscape({
  nodes,
  edges,
  enabledLabels,
  searchTerm,
  highlights,
  showEdgeLabels = false,
  height = 620,
  onSelect,
}: GraphCytoscapeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  // Filter nodes / edges using the user-controlled filters. Memoised so we
  // don't rebuild the cytoscape instance unnecessarily on each render.
  const elements = useMemo<ElementDefinition[]>(() => {
    const labelsAllowed = enabledLabels && enabledLabels.size > 0 ? enabledLabels : null;
    const search = (searchTerm ?? "").trim().toLowerCase();

    const visibleNodeIds = new Set<string>();
    const nodeEls: ElementDefinition[] = [];

    for (const n of nodes) {
      if (labelsAllowed && !labelsAllowed.has(n.label)) continue;
      if (search) {
        const matches =
          n.id.toLowerCase().includes(search) || (n.name?.toLowerCase().includes(search) ?? false);
        if (!matches) continue;
      }
      visibleNodeIds.add(n.id);
      const classes = [
        `label-${n.label}`,
        isInactive(n) ? "inactive" : "",
      ]
        .filter(Boolean)
        .join(" ");
      nodeEls.push({
        group: "nodes",
        data: {
          ...n,
          id: n.id,
          displayLabel: n.name ?? n.id,
        },
        classes,
      });
    }

    const edgeEls: ElementDefinition[] = [];
    for (const e of edges) {
      if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) continue;
      const id = edgeKey(e);
      const classes = [
        `rel-${e.relType}`,
        isBlockedEdge(e) ? "blocked" : "",
        showEdgeLabels ? "show-label" : "",
      ]
        .filter(Boolean)
        .join(" ");
      edgeEls.push({
        group: "edges",
        data: {
          id,
          source: e.source,
          target: e.target,
          relType: e.relType,
          status: e.status ?? "open",
          cost: e.cost ?? null,
        },
        classes,
      });
    }
    return [...nodeEls, ...edgeEls];
  }, [nodes, edges, enabledLabels, searchTerm, showEdgeLabels]);

  // Initialise / update cytoscape ----------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    if (!cyRef.current) {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements,
        style: cytoscapeStylesheet,
        layout: fcoseLayoutOptions as unknown as LayoutOptions,
        wheelSensitivity: 0.25,
        minZoom: 0.1,
        maxZoom: 3,
      });

      cyRef.current.on("tap", "node", (evt) => {
        const data = evt.target.data() as TopologyNode;
        onSelect?.({ kind: "node", data });
      });
      cyRef.current.on("tap", "edge", (evt) => {
        const d = evt.target.data() as TopologyEdge & { id: string };
        onSelect?.({ kind: "edge", data: d });
      });
      cyRef.current.on("tap", (evt) => {
        if (evt.target === cyRef.current) onSelect?.(null);
      });
    } else {
      const cy = cyRef.current;
      cy.batch(() => {
        cy.elements().remove();
        cy.add(elements);
      });
      cy.layout(fcoseLayoutOptions as unknown as LayoutOptions).run();
    }
    return () => {
      // Don't destroy on every effect, only on unmount handled below.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  // Apply highlight classes whenever `highlights` change without rebuilding.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass(
        "impact optimized algo-top path-node faded path-edge impact-edge"
      );
      const noHighlights =
        !highlights ||
        ((!highlights.impactNodes || highlights.impactNodes.size === 0) &&
          (!highlights.optimizedNodes || highlights.optimizedNodes.size === 0) &&
          (!highlights.algoTopNodes || highlights.algoTopNodes.size === 0) &&
          (!highlights.pathNodes || highlights.pathNodes.size === 0) &&
          (!highlights.pathEdgeKeys || highlights.pathEdgeKeys.size === 0) &&
          (!highlights.impactEdgeKeys || highlights.impactEdgeKeys.size === 0));
      if (noHighlights) return;

      const fadeAll = !!(
        (highlights?.algoTopNodes && highlights.algoTopNodes.size > 0) ||
        (highlights?.pathNodes && highlights.pathNodes.size > 0) ||
        (highlights?.impactNodes && highlights.impactNodes.size > 0)
      );
      if (fadeAll) cy.elements().addClass("faded");
      const reveal = (id: string) => cy.getElementById(id).removeClass("faded");

      highlights?.impactNodes?.forEach((id) => {
        cy.getElementById(id).addClass("impact");
        reveal(id);
      });
      highlights?.optimizedNodes?.forEach((id) => {
        cy.getElementById(id).addClass("optimized");
        reveal(id);
      });
      highlights?.algoTopNodes?.forEach((id) => {
        cy.getElementById(id).addClass("algo-top");
        reveal(id);
      });
      highlights?.pathNodes?.forEach((id) => {
        cy.getElementById(id).addClass("path-node");
        reveal(id);
      });
      highlights?.pathEdgeKeys?.forEach((key) => {
        const ele = cy.getElementById(key);
        if (ele.length > 0) {
          ele.addClass("path-edge");
          ele.removeClass("faded");
        }
      });
      highlights?.impactEdgeKeys?.forEach((key) => {
        const ele = cy.getElementById(key);
        if (ele.length > 0) {
          ele.addClass("impact-edge");
          ele.removeClass("faded");
        }
      });
    });
  }, [highlights]);

  useEffect(() => {
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  return (
    <div className="card relative" style={{ height }}>
      <div ref={containerRef} className="w-full h-full rounded-xl" />
      <Legend />
    </div>
  );
}

function Legend() {
  const entries = Object.entries(LABEL_COLORS);
  return (
    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg p-2.5 shadow-sm max-w-[260px]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        Etiquetas de nodo
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {entries.map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-700">
            <span
              className="inline-block rounded-full"
              style={{ backgroundColor: color, width: 8, height: 8 }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
