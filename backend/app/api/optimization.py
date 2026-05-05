"""Optimization endpoints (Phase 6) and comparison endpoint (Phase 7)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.db.neo4j_client import Neo4jClientError
from app.optimization.data_loader import DataLoader
from app.optimization.solver import SolverWeights, solve
from app.optimization.writeback import persist

router = APIRouter(tags=["optimization"])


class OptimizationRequest(BaseModel):
    scenarioId: str | None = Field(
        default=None,
        description="Scenario id to associate the result with. Use null/empty for the baseline run.",
    )
    weights: dict[str, float] | None = Field(
        default=None,
        description="Optional override of the objective weights (alpha, beta, gamma, delta).",
    )
    timeLimitSeconds: int = Field(default=10, ge=1, le=60)


@router.post("/optimization/run", summary="Solve order-to-warehouse assignment")
def run_optimization(payload: OptimizationRequest) -> dict:
    weights = SolverWeights()
    if payload.weights:
        for key in ("alpha", "beta", "gamma", "delta"):
            if key in payload.weights:
                setattr(weights, key, float(payload.weights[key]))

    try:
        loader = DataLoader()
        data = loader.load()
        result = solve(data, weights, time_limit_s=payload.timeLimitSeconds)
        assignment_id = persist(result, payload.scenarioId)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return {
        "assignmentId": assignment_id,
        "scenarioId": payload.scenarioId or "BASELINE",
        "status": result.status,
        "objectiveValue": result.objective_value,
        "runtimeMs": result.runtime_ms,
        "weights": result.weights.__dict__,
        "diagnostics": result.diagnostics,
        "assignments": [
            {
                "orderId": a.order_id,
                "warehouseId": a.warehouse_id,
                "cost": a.cost,
                "leadTime": a.lead_time,
                "risk": a.risk,
            }
            for a in result.assignments
        ],
        "unfulfilledOrderIds": result.unfulfilled_order_ids,
    }


# Comparison endpoint is implemented in Phase 7 and registered later via
# app.analysis.kpis_router. The placeholder lives here to keep the prefix
# `/scenarios/{id}/comparison` discoverable in the OpenAPI schema.
from app.analysis.kpis import router as kpis_router  # noqa: E402

router.include_router(kpis_router)
