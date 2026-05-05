"""HTTP routes for the Algorithms page.

Exposes PageRank, Betweenness, Communities (Louvain) and Dijkstra shortest
path. All implementations live in `app.analysis.algorithms` and are computed
in-process via NetworkX because Aura Free does not include the GDS plug-in.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.analysis import algorithms as algos
from app.db.neo4j_client import Neo4jClientError

router = APIRouter(prefix="/algorithms", tags=["algorithms"])


@router.get("/pagerank")
def get_pagerank(
    topN: int = Query(20, ge=1, le=100),
    weight: Literal["baseCost", "uniform"] = Query("uniform"),
) -> dict:
    try:
        return algos.pagerank(top_n=topN, weight=weight)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/betweenness")
def get_betweenness(topN: int = Query(20, ge=1, le=100)) -> dict:
    try:
        return algos.betweenness(top_n=topN)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/communities")
def get_communities() -> dict:
    try:
        return algos.communities()
    except Neo4jClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/shortest-path")
def get_shortest_path(
    source: str = Query(..., min_length=1),
    target: str = Query(..., min_length=1),
    weight: Literal["baseCost", "leadTimeDays"] = Query("baseCost"),
) -> dict:
    try:
        return algos.shortest_path(source=source, target=target, weight=weight)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/persist-centrality")
def persist_centrality(topN: int = Query(20, ge=1, le=100)) -> dict:
    """Compute PageRank + Betweenness and store both back on the graph nodes.

    The frontend can call this once before the demo so the property panel
    shows centrality scores for every node without having to recompute on
    each request.
    """
    try:
        pr = algos.pagerank(top_n=topN)
        bt = algos.betweenness(top_n=topN)
        upd = algos.persist_pagerank_betweenness(pr["results"], bt["results"])
        return {
            "updated": upd["updated"],
            "pagerankTop": pr["results"][:5],
            "betweennessTop": bt["results"][:5],
        }
    except Neo4jClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
