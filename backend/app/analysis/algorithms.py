"""Graph algorithms for `/algorithms/*` (NetworkX / python-louvain; no Neo4j GDS on Aura Free).

Includes PageRank, betweenness, weakly connected components, Dijkstra, Louvain.
Returns JSON-serialisable dicts.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Literal

import community as louvain  # python-louvain
import networkx as nx

from app.analysis.graph_loader import GraphSnapshot, load_core_graph, to_simple_weighted
from app.db.neo4j_client import get_neo4j_client

logger = logging.getLogger(__name__)


def _node_meta(snapshot: GraphSnapshot, node_id: str) -> dict[str, Any]:
    data = snapshot.graph.nodes.get(node_id, {})
    return {
        "id": node_id,
        "label": data.get("label"),
        "name": data.get("name"),
    }


def pagerank(
    snapshot: GraphSnapshot | None = None,
    top_n: int = 20,
    weight: Literal["baseCost", "uniform"] = "uniform",
) -> dict[str, Any]:
    snap = snapshot or load_core_graph()
    g_simple = to_simple_weighted(snap.graph, weight_key="baseCost")
    if weight == "baseCost":
        # PageRank uses higher weights as more important, but baseCost behaves
        # in the opposite direction. Convert to importance = 1 / (1 + baseCost).
        for u, v, data in g_simple.edges(data=True):
            data["pagerank_w"] = 1.0 / (1.0 + float(data.get("baseCost", 1.0)))
        scores = nx.pagerank(g_simple, weight="pagerank_w")
    else:
        scores = nx.pagerank(g_simple)

    items = [
        {**_node_meta(snap, n), "score": round(float(s), 6)}
        for n, s in scores.items()
    ]
    items.sort(key=lambda r: r["score"], reverse=True)
    return {
        "algorithm": "pagerank",
        "weight": weight,
        "topN": top_n,
        "results": items[:top_n],
        "interpretation": (
            "PageRank ordena nodos según la frecuencia con la que un paseo aleatorio los visita. "
            "En una cadena de suministro, una puntuación alta indica focos críticos (almacenes, "
            "proveedores clave, ubicaciones centrales) cuya disrupción se propaga más."
        ),
    }


def betweenness(
    snapshot: GraphSnapshot | None = None,
    top_n: int = 20,
) -> dict[str, Any]:
    snap = snapshot or load_core_graph()
    g_simple = to_simple_weighted(snap.graph, weight_key="baseCost")
    scores = nx.betweenness_centrality(g_simple, weight="baseCost", normalized=True)
    items = [
        {**_node_meta(snap, n), "score": round(float(s), 6)}
        for n, s in scores.items()
    ]
    items.sort(key=lambda r: r["score"], reverse=True)
    return {
        "algorithm": "betweenness",
        "topN": top_n,
        "results": items[:top_n],
        "interpretation": (
            "La centralidad de intermediación cuenta cuántas veces cada nodo aparece en el camino "
            "más corto entre pares de nodos. Valores altos marcan cuellos de botella: al eliminarlos "
            "se parte la cadena o se obligan rutas alternativas mucho más largas."
        ),
    }


def shortest_path(
    source: str,
    target: str,
    weight: Literal["baseCost", "leadTimeDays"] = "baseCost",
    directed: bool = False,
    snapshot: GraphSnapshot | None = None,
) -> dict[str, Any]:
    """Dijkstra shortest path. Defaults to undirected because "find me a route
    between supplier S1 and warehouse W1" is a logistical query, and edges
    in our model carry physical adjacency that does not depend on direction.
    """
    snap = snapshot or load_core_graph()
    g_simple = to_simple_weighted(snap.graph, weight_key=weight)
    g = g_simple if directed else g_simple.to_undirected()
    if source not in g.nodes or target not in g.nodes:
        return {
            "algorithm": "dijkstra",
            "weight": weight,
            "directed": directed,
            "found": False,
            "reason": f"Id de nodo desconocido: {source if source not in g.nodes else target}",
            "path": [],
            "totalWeight": None,
        }
    try:
        path = nx.dijkstra_path(g, source, target, weight=weight)
        total = nx.dijkstra_path_length(g, source, target, weight=weight)
    except nx.NetworkXNoPath:
        return {
            "algorithm": "dijkstra",
            "weight": weight,
            "directed": directed,
            "found": False,
            "reason": "No hay camino entre los dos nodos en el grafo actual.",
            "path": [],
            "totalWeight": None,
        }
    edge_keys: list[str] = []
    nodes_meta: list[dict[str, Any]] = [_node_meta(snap, n) for n in path]
    for u, v in zip(path, path[1:]):
        # Use the directed source-of-truth to find the edge type in the
        # original directed view; if the directed edge does not exist (because
        # we walked it backwards in the undirected version), fall back to v->u.
        if g_simple.has_edge(u, v):
            rel_type = g_simple[u][v].get("relType", "?")
            edge_keys.append(f"{u}->{v}:{rel_type}")
        elif g_simple.has_edge(v, u):
            rel_type = g_simple[v][u].get("relType", "?")
            edge_keys.append(f"{v}->{u}:{rel_type}")
        else:
            edge_keys.append(f"{u}--{v}:?")
    return {
        "algorithm": "dijkstra",
        "weight": weight,
        "directed": directed,
        "found": True,
        "path": [m["id"] for m in nodes_meta],
        "nodes": nodes_meta,
        "edgeKeys": edge_keys,
        "hops": len(path) - 1,
        "totalWeight": round(float(total), 4),
        "interpretation": (
            f"Dijkstra obtiene el camino de menor coste según el peso elegido ({weight}). "
            "Es la base algorítmica de la planificación de rutas por coste o plazo."
        ),
    }


def communities(snapshot: GraphSnapshot | None = None) -> dict[str, Any]:
    snap = snapshot or load_core_graph()
    g_simple = to_simple_weighted(snap.graph, weight_key="baseCost")
    g_und = g_simple.to_undirected()
    if g_und.number_of_nodes() == 0:
        return {
            "algorithm": "louvain",
            "communities": [],
            "modularity": 0.0,
            "results": [],
        }
    partition = louvain.best_partition(g_und, weight="baseCost", random_state=42)
    modularity = louvain.modularity(partition, g_und, weight="baseCost")
    by_community: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for node_id, comm_id in partition.items():
        by_community[comm_id].append(_node_meta(snap, node_id))
    summary = []
    for comm_id, members in sorted(by_community.items(), key=lambda kv: -len(kv[1])):
        labels: dict[str, int] = defaultdict(int)
        for m in members:
            labels[m.get("label") or "?"] += 1
        summary.append(
            {
                "communityId": comm_id,
                "size": len(members),
                "byLabel": dict(labels),
                "sample": members[:6],
            }
        )
    return {
        "algorithm": "louvain",
        "modularity": round(float(modularity), 4),
        "totalCommunities": len(by_community),
        "communities": summary,
        "membership": partition,
        "interpretation": (
            "Louvain agrupa nodos en comunidades que maximizan la modularidad. "
            "En una cadena de suministro suelen aparecer agrupaciones naturales: una región con "
            "sus almacenes y clientes, o una familia de producto con sus proveedores y materiales."
        ),
    }


def persist_pagerank_betweenness(
    pagerank_results: list[dict[str, Any]],
    betweenness_results: list[dict[str, Any]],
) -> dict[str, int]:
    """Write PageRank and betweenness onto Supplier nodes (matched by `id`)."""
    cli = get_neo4j_client()
    rows = []
    pr_lookup = {r["id"]: r["score"] for r in pagerank_results}
    bt_lookup = {r["id"]: r["score"] for r in betweenness_results}
    for nid, score in pr_lookup.items():
        rows.append({"id": nid, "pageRank": score, "betweenness": bt_lookup.get(nid)})
    cypher = """
    UNWIND $rows AS row
    MATCH (n) WHERE n.id = row.id
    SET n.pageRank = row.pageRank
    FOREACH (_ IN CASE WHEN row.betweenness IS NOT NULL THEN [1] ELSE [] END |
        SET n.betweenness = row.betweenness)
    """
    cli.run_write(cypher, {"rows": rows})
    return {"updated": len(rows)}
