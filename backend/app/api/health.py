"""Health endpoints for liveness and Neo4j connectivity."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.neo4j_client import Neo4jClientError, get_neo4j_client

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Application liveness")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/neo4j", summary="Neo4j AuraDB connectivity check")
def health_neo4j() -> dict[str, str]:
    client = get_neo4j_client()
    try:
        rows = client.run('RETURN "Neo4j AuraDB connection successful" AS message')
    except Neo4jClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Empty response from Neo4j",
        )
    return {"status": "ok", "message": rows[0]["message"]}
