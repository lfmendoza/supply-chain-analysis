"""FastAPI entrypoint.

Wires routers and lifespan hooks. Run with:

    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    algorithms,
    analysis_meta,
    csv_upload,
    cypher_exec,
    graph,
    health,
    ml,
    operations,
    optimization,
    simulation,
)
from app.config import get_settings
from app.db.neo4j_client import Neo4jClientError, get_neo4j_client, reset_neo4j_client

logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    logger.info("Starting backend with config: %s", settings.safe_repr())
    try:
        get_neo4j_client().verify_connectivity()
    except Neo4jClientError as exc:
        # Do not crash startup: health endpoint will surface the error.
        logger.warning("Neo4j connectivity check failed at startup: %s", exc)
    try:
        yield
    finally:
        reset_neo4j_client()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Supply Chain Network Analysis & Optimization",
        version="0.1.0",
        description=(
            "Backend that combines Neo4j (graph topology and analysis), "
            "OR-Tools (combinatorial optimization), and a small ML model "
            "(supplier risk scoring) for an academic MVP."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(graph.router)
    app.include_router(simulation.router)
    app.include_router(optimization.router)
    app.include_router(ml.router)
    app.include_router(operations.router)
    app.include_router(cypher_exec.router)
    app.include_router(analysis_meta.router)
    app.include_router(algorithms.router)
    app.include_router(csv_upload.router)

    return app


app = create_app()
