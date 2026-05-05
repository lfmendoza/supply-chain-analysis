"""Build a NetworkX graph from Neo4j for in-process algorithms.

We pull the supply-chain "core" subgraph (excluding `DisruptionScenario` and
`OptimizedAssignment`, which are auxiliary) and load it into a `MultiDiGraph`.
For weighted algorithms we copy `baseCost` and `leadTimeDays` from
`CONNECTED_TO`, plus a fallback weight of 1 for the rest.

This file exists because Neo4j AuraDB Free does not include the GDS plug-in,
so we explicitly run graph algorithms in Python via NetworkX.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import networkx as nx

from app.db.neo4j_client import Neo4jClient, get_neo4j_client


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


_LABEL_FILTER_NODES = " OR ".join(f"n:{label}" for label in CORE_LABELS)
_LABEL_FILTER_A = " OR ".join(f"a:{label}" for label in CORE_LABELS)
_LABEL_FILTER_B = " OR ".join(f"b:{label}" for label in CORE_LABELS)


_NODES_QUERY = f"""
MATCH (n)
WHERE {_LABEL_FILTER_NODES}
RETURN coalesce(n.id, elementId(n)) AS id,
       labels(n)[0] AS label,
       coalesce(n.name, n.id, '') AS name,
       coalesce(n.status, 'active') AS status,
       coalesce(n.riskScore, null) AS riskScore
"""


_EDGES_QUERY = f"""
MATCH (a)-[r]->(b)
WHERE ({_LABEL_FILTER_A}) AND ({_LABEL_FILTER_B})
RETURN coalesce(a.id, elementId(a)) AS source,
       coalesce(b.id, elementId(b)) AS target,
       type(r) AS relType,
       coalesce(r.baseCost, null) AS baseCost,
       coalesce(r.leadTimeDays, null) AS leadTimeDays,
       coalesce(r.status, null) AS status
"""


@dataclass
class GraphSnapshot:
    graph: nx.MultiDiGraph
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


def load_core_graph(client: Neo4jClient | None = None) -> GraphSnapshot:
    cli = client or get_neo4j_client()
    nodes = cli.run(_NODES_QUERY)
    edges = cli.run(_EDGES_QUERY)
    g: nx.MultiDiGraph = nx.MultiDiGraph()
    for n in nodes:
        g.add_node(
            n["id"],
            label=n["label"],
            name=n["name"],
            status=n["status"],
            riskScore=n["riskScore"],
        )
    for e in edges:
        if e["source"] in g.nodes and e["target"] in g.nodes:
            base_cost = e["baseCost"] if e["baseCost"] is not None else 1.0
            lead_time = e["leadTimeDays"] if e["leadTimeDays"] is not None else 1.0
            g.add_edge(
                e["source"],
                e["target"],
                relType=e["relType"],
                baseCost=float(base_cost),
                leadTimeDays=float(lead_time),
                weight=float(base_cost),
                status=e["status"],
            )
    return GraphSnapshot(graph=g, nodes=nodes, edges=edges)


def to_simple_weighted(g: nx.MultiDiGraph, weight_key: str = "weight") -> nx.DiGraph:
    """Collapse parallel edges, keeping the minimum weight (best path)."""
    simple: nx.DiGraph = nx.DiGraph()
    for n, data in g.nodes(data=True):
        simple.add_node(n, **data)
    for u, v, data in g.edges(data=True):
        w = float(data.get(weight_key, 1.0))
        if simple.has_edge(u, v):
            existing = simple[u][v].get(weight_key, float("inf"))
            if w < existing:
                simple[u][v][weight_key] = w
                for k, val in data.items():
                    simple[u][v][k] = val
        else:
            simple.add_edge(u, v, **data)
            simple[u][v][weight_key] = w
    return simple
