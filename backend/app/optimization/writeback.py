"""Persist the solver result back into the graph.

Creates an `OptimizedAssignment` node and `RECOMMENDED` relationships, and
also writes lightweight `ASSIGNED_TO` edges from each order to the chosen
warehouse so the dashboard can highlight the new flow on the topology.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.db.neo4j_client import Neo4jClient, get_neo4j_client
from app.optimization.solver import SolverResult


CREATE_ASSIGNMENT = """
MERGE (oa:OptimizedAssignment {id: $id})
SET oa.scenarioId = $scenarioId,
    oa.objectiveValue = $objectiveValue,
    oa.runtimeMs = $runtimeMs,
    oa.solvedAt = $solvedAt,
    oa.status = $status
RETURN oa.id AS id
"""

LINK_RECOMMENDED = """
UNWIND $rows AS row
MATCH (oa:OptimizedAssignment {id: $assignmentId}),
      (co:CustomerOrder {id: row.orderId}),
      (w:Warehouse {id: row.warehouseId})
MERGE (oa)-[r:RECOMMENDED]->(co)
SET r.cost = row.cost,
    r.leadTime = row.leadTime,
    r.risk = row.risk,
    r.warehouseId = row.warehouseId
MERGE (co)-[a:ASSIGNED_TO]->(w)
SET a.scenarioId = $scenarioId,
    a.assignedAt = $solvedAt
"""

CLEAR_PREVIOUS_ASSIGNMENT_FOR_SCENARIO = """
MATCH (oa:OptimizedAssignment {scenarioId: $scenarioId})
DETACH DELETE oa
"""


def _make_id() -> str:
    return f"OA-{uuid.uuid4().hex[:8].upper()}"


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def persist(result: SolverResult, scenario_id: str | None, client: Neo4jClient | None = None) -> str:
    """Persist solver output. Returns the assignment id."""
    cli = client or get_neo4j_client()
    assignment_id = _make_id()
    solved_at = _now()
    sid = scenario_id or "BASELINE"

    cli.run_write(CLEAR_PREVIOUS_ASSIGNMENT_FOR_SCENARIO, {"scenarioId": sid})
    cli.run_write(
        CREATE_ASSIGNMENT,
        {
            "id": assignment_id,
            "scenarioId": sid,
            "objectiveValue": result.objective_value,
            "runtimeMs": result.runtime_ms,
            "solvedAt": solved_at,
            "status": result.status,
        },
    )

    rows = [
        {
            "orderId": a.order_id,
            "warehouseId": a.warehouse_id,
            "cost": a.cost,
            "leadTime": a.lead_time,
            "risk": a.risk,
        }
        for a in result.assignments
    ]
    if rows:
        cli.run_write(
            LINK_RECOMMENDED,
            {
                "assignmentId": assignment_id,
                "scenarioId": sid,
                "solvedAt": solved_at,
                "rows": rows,
            },
        )
    return assignment_id
