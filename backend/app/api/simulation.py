"""Simulation endpoints: create, list, inspect and revert disruption scenarios."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.db.neo4j_client import Neo4jClientError
from app.simulation.engine import SimulationEngine, SimulationError
from app.simulation.scenarios import DisruptionType

router = APIRouter(prefix="/simulation", tags=["simulation"])


class SimulationRequest(BaseModel):
    type: DisruptionType = Field(..., description="One of the 5 supported disruption types.")
    params: dict[str, Any] = Field(default_factory=dict, description="Type-specific parameters.")
    description: str | None = Field(default=None, description="Optional human-readable description.")


@router.post("/run", summary="Apply a disruption scenario")
def run_simulation(payload: SimulationRequest) -> dict:
    engine = SimulationEngine()
    try:
        return engine.apply(payload.type, payload.params, payload.description)
    except SimulationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Neo4jClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/revert/{scenario_id}", summary="Revert a disruption scenario")
def revert_simulation(scenario_id: str) -> dict:
    engine = SimulationEngine()
    try:
        return engine.revert(scenario_id)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/scenarios", summary="List active and resolved disruption scenarios")
def list_scenarios() -> list[dict]:
    engine = SimulationEngine()
    try:
        return engine.list_scenarios()
    except Neo4jClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/scenarios/{scenario_id}/impacts", summary="Get the impact targets for a scenario")
def scenario_impacts(scenario_id: str) -> list[dict]:
    engine = SimulationEngine()
    try:
        return engine.get_impacts(scenario_id)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
