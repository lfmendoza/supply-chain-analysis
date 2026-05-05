"""Dashboard helpers: connectivity (NetworkX WCC) and data-type inventory (Neo4j schema)."""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

import networkx as nx
from fastapi import APIRouter, HTTPException

from app.db.neo4j_client import Neo4jClientError, get_neo4j_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


# Labels we consider when assessing whether the *supply chain* graph is
# connected. Auxiliary labels are intentionally excluded.
CORE_LABELS = (
    "Supplier",
    "RawMaterial",
    "Product",
    "Warehouse",
    "Inventory",
    "Customer",
    "CustomerOrder",
    "PurchaseOrder",
    "Shipment",
    "Route",
    "Carrier",
    "Location",
)


_LABEL_FILTER = " OR ".join(f"n:{label}" for label in CORE_LABELS)


_CONNECTIVITY_NODES = f"""
MATCH (n)
WHERE {_LABEL_FILTER}
RETURN elementId(n) AS id, labels(n)[0] AS label, coalesce(n.id, '') AS domainId
"""


_CONNECTIVITY_EDGES = f"""
MATCH (a)-[r]->(b)
WHERE ({_LABEL_FILTER.replace('n:', 'a:')}) AND ({_LABEL_FILTER.replace('n:', 'b:')})
RETURN elementId(a) AS source, elementId(b) AS target, type(r) AS relType
"""


@router.get("/connectivity")
def connectivity() -> dict:
    """Weakly-connected components on `CORE_LABELS`; payload aligned with the frontend type."""
    try:
        nodes = get_neo4j_client().run(_CONNECTIVITY_NODES)
        edges = get_neo4j_client().run(_CONNECTIVITY_EDGES)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    g = nx.DiGraph()
    for n in nodes:
        g.add_node(n["id"], label=n["label"], domainId=n["domainId"])
    for e in edges:
        if e["source"] in g.nodes and e["target"] in g.nodes:
            g.add_edge(e["source"], e["target"], relType=e["relType"])

    if g.number_of_nodes() == 0:
        return {
            "isConnected": False,
            "nodes": 0,
            "relationships": 0,
            "components": 0,
            "largestComponentSize": 0,
            "largestComponentRatio": 0.0,
            "isolatedNodes": [],
            "componentSummary": [],
        }

    components = sorted(
        (set(c) for c in nx.weakly_connected_components(g)),
        key=len,
        reverse=True,
    )
    largest = components[0]
    isolated_nodes: list[dict[str, str]] = []
    for n_id, data in g.nodes(data=True):
        if g.in_degree(n_id) == 0 and g.out_degree(n_id) == 0:
            isolated_nodes.append(
                {
                    "id": data.get("domainId") or n_id,
                    "label": data.get("label", "?"),
                }
            )

    component_summary: list[dict[str, Any]] = []
    for idx, comp in enumerate(components[:5]):
        labels: dict[str, int] = defaultdict(int)
        sample_nodes: list[str] = []
        for nid in comp:
            data = g.nodes[nid]
            labels[data.get("label", "?")] += 1
            if len(sample_nodes) < 5:
                sample_nodes.append(data.get("domainId") or nid)
        component_summary.append(
            {
                "rank": idx + 1,
                "size": len(comp),
                "byLabel": dict(labels),
                "sampleNodes": sample_nodes,
            }
        )

    total = g.number_of_nodes()
    return {
        "isConnected": len(components) == 1,
        "nodes": total,
        "relationships": g.number_of_edges(),
        "components": len(components),
        "largestComponentSize": len(largest),
        "largestComponentRatio": round(len(largest) / total, 4),
        "isolatedNodes": isolated_nodes,
        "componentSummary": component_summary,
    }


_NODE_TYPES = """
CALL db.schema.nodeTypeProperties()
YIELD nodeType, propertyName, propertyTypes, mandatory
RETURN nodeType, propertyName, propertyTypes, mandatory
ORDER BY nodeType, propertyName
"""

_REL_TYPES = """
CALL db.schema.relTypeProperties()
YIELD relType, propertyName, propertyTypes, mandatory
RETURN relType, propertyName, propertyTypes, mandatory
ORDER BY relType, propertyName
"""


# Map db.schema.* storage types to coarse logical buckets (String, Integer, …).
TYPE_BUCKETS = {
    "String": "String",
    "Long": "Integer",
    "Integer": "Integer",
    "Double": "Float",
    "Float": "Float",
    "Boolean": "Boolean",
    "Date": "Date",
    "DateTime": "DateTime",
    "LocalDateTime": "DateTime",
    "Time": "Time",
    "LocalTime": "Time",
    "Duration": "Duration",
    "Point": "Point",
    "ByteArray": "ByteArray",
    "StringArray": "List",
    "LongArray": "List",
    "DoubleArray": "List",
    "BooleanArray": "List",
}


def _bucket(types_list: list[str] | None) -> list[str]:
    if not types_list:
        return []
    out: list[str] = []
    for t in types_list:
        if not t:
            continue
        if t.endswith("Array"):
            out.append("List")
        elif t in TYPE_BUCKETS:
            out.append(TYPE_BUCKETS[t])
        else:
            out.append(t)
    seen = []
    for t in out:
        if t not in seen:
            seen.append(t)
    return seen


@router.get("/data-types")
def data_types() -> dict:
    """Property types from `db.schema.nodeTypeProperties` / `relTypeProperties`."""
    try:
        node_rows = get_neo4j_client().run(_NODE_TYPES)
        rel_rows = get_neo4j_client().run(_REL_TYPES)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    nodes_out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    rels_out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_buckets: set[str] = set()

    for r in node_rows:
        # nodeType comes back like ":`Supplier`" — strip the wrapper.
        label = (r["nodeType"] or "").lstrip(":").strip("`")
        types = _bucket(r.get("propertyTypes"))
        if r["propertyName"]:
            nodes_out[label].append(
                {
                    "property": r["propertyName"],
                    "types": types,
                    "mandatory": r.get("mandatory", False),
                }
            )
        for t in types:
            seen_buckets.add(t)

    for r in rel_rows:
        relt = (r["relType"] or "").lstrip(":").strip("`")
        types = _bucket(r.get("propertyTypes"))
        if r["propertyName"]:
            rels_out[relt].append(
                {
                    "property": r["propertyName"],
                    "types": types,
                    "mandatory": r.get("mandatory", False),
                }
            )
        for t in types:
            seen_buckets.add(t)

    expected = ("String", "Integer", "Float", "Boolean", "Date", "DateTime", "List", "Point")
    coverage = {t: t in seen_buckets for t in expected}

    return {
        "nodes": dict(nodes_out),
        "relationships": dict(rels_out),
        "typesSeen": sorted(seen_buckets),
        "coverage": coverage,
        "missing": [t for t, present in coverage.items() if not present],
    }
