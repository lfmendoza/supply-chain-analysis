"""Public Cypher executor (read/write `mode`). Mutations are rejected in read mode at the DB."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db.neo4j_client import Neo4jClientError, get_neo4j_client

router = APIRouter(prefix="/cypher", tags=["cypher"])


class ExecuteCypherBody(BaseModel):
    cypher: str = Field(..., min_length=1)
    params: dict[str, Any] = Field(default_factory=dict)
    mode: Literal["read", "write"] = "read"
    timeoutSeconds: float = Field(10.0, ge=0.5, le=60.0)


class ExecuteCypherResult(BaseModel):
    mode: str
    rowCount: int
    rows: list[dict[str, Any]]
    stats: dict[str, Any]
    columns: list[str]


@router.post("/execute", response_model=ExecuteCypherResult)
def execute_cypher(body: ExecuteCypherBody) -> ExecuteCypherResult:
    settings = get_settings()
    if body.mode == "write" and not settings.ALLOW_CYPHER_WRITE:
        raise HTTPException(
            status_code=403,
            detail=(
                "Write mode is disabled (ALLOW_CYPHER_WRITE=false). "
                "Toggle the env var to allow writes from the Cypher Explorer."
            ),
        )
    try:
        result = get_neo4j_client().run_in_mode(
            body.cypher, body.params, mode=body.mode, timeout_seconds=body.timeoutSeconds
        )
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    columns = list(result["rows"][0].keys()) if result["rows"] else []
    return ExecuteCypherResult(
        mode=result["mode"],
        rowCount=result["rowCount"],
        rows=result["rows"],
        stats=result["stats"],
        columns=columns,
    )
