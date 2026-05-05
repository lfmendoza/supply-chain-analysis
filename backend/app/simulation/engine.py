"""High-level disruption engine.

`SimulationEngine.apply(...)` creates a `DisruptionScenario` node, mutates the
target nodes/relationships saving baselines, and materializes `IMPACTS` edges.

`SimulationEngine.revert(...)` restores baselines and removes the scenario.

The class delegates Cypher execution to the shared `Neo4jClient` singleton.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.neo4j_client import Neo4jClient, get_neo4j_client
from app.simulation.scenarios import (
    APPLY_COST_INCREASE,
    APPLY_DEMAND_SPIKE,
    APPLY_INVENTORY_DROP,
    APPLY_ROUTE_BLOCKED,
    APPLY_SUPPLIER_DOWN,
    CREATE_SCENARIO,
    DisruptionType,
    GET_SCENARIO_IMPACTS,
    LIST_SCENARIOS,
    REVERT_DETACH_SCENARIO,
    REVERT_INVENTORY_SCOPED,
    REVERT_ORDERS_SCOPED,
    REVERT_ROUTES_COST_SCOPED,
    REVERT_ROUTES_STATUS_SCOPED,
    REVERT_SUPPLIERS_SCOPED,
)


class SimulationError(ValueError):
    """Raised on bad input or inconsistent simulation state."""


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _make_id() -> str:
    return f"DS-{uuid.uuid4().hex[:8].upper()}"


class SimulationEngine:
    def __init__(self, client: Neo4jClient | None = None) -> None:
        self._client = client or get_neo4j_client()

    # --- public API -------------------------------------------------------

    def apply(self, dtype: DisruptionType, params: dict[str, Any], description: str | None = None) -> dict:
        scenario_id = _make_id()
        created_at = _now()
        self._client.run_write(
            CREATE_SCENARIO,
            {
                "id": scenario_id,
                "type": dtype.value,
                "description": description or self._auto_description(dtype, params),
                "params": json.dumps(params),
                "createdAt": created_at,
            },
        )
        impacts = self._dispatch_apply(dtype, scenario_id, params, created_at)
        return {
            "scenarioId": scenario_id,
            "type": dtype.value,
            "createdAt": created_at,
            "params": params,
            "impacts": impacts,
        }

    def revert(self, scenario_id: str) -> dict:
        # Scenario-scoped: only restore baselines on entities reachable from
        # this scenario via IMPACTS, then detach the scenario node. Multiple
        # active scenarios can therefore coexist and be reverted independently.
        params = {"scenarioId": scenario_id}
        self._client.run_write(REVERT_SUPPLIERS_SCOPED, params)
        self._client.run_write(REVERT_ROUTES_STATUS_SCOPED, params)
        self._client.run_write(REVERT_ROUTES_COST_SCOPED, params)
        self._client.run_write(REVERT_INVENTORY_SCOPED, params)
        self._client.run_write(REVERT_ORDERS_SCOPED, params)
        self._client.run_write(REVERT_DETACH_SCENARIO, params)
        return {"status": "reverted", "scenarioId": scenario_id}

    def list_scenarios(self) -> list[dict]:
        return self._client.run(LIST_SCENARIOS)

    def get_impacts(self, scenario_id: str) -> list[dict]:
        return self._client.run(GET_SCENARIO_IMPACTS, {"scenarioId": scenario_id})

    # --- internal ---------------------------------------------------------

    def _dispatch_apply(
        self,
        dtype: DisruptionType,
        scenario_id: str,
        params: dict[str, Any],
        simulated_at: str,
    ) -> list[dict]:
        if dtype is DisruptionType.SUPPLIER_DOWN:
            self._require(params, "supplierId")
            return self._client.run_write(
                APPLY_SUPPLIER_DOWN,
                {
                    "scenarioId": scenario_id,
                    "supplierId": params["supplierId"],
                    "simulatedAt": simulated_at,
                },
            )

        if dtype is DisruptionType.ROUTE_BLOCKED:
            self._require(params, "routeId")
            return self._client.run_write(
                APPLY_ROUTE_BLOCKED,
                {
                    "scenarioId": scenario_id,
                    "routeId": params["routeId"],
                    "simulatedAt": simulated_at,
                },
            )

        if dtype is DisruptionType.DEMAND_SPIKE:
            self._require(params, "productId")
            factor = float(params.get("factor", 1.5))
            if factor <= 1.0:
                raise SimulationError("demand_spike factor must be > 1.0")
            return self._client.run_write(
                APPLY_DEMAND_SPIKE,
                {
                    "scenarioId": scenario_id,
                    "productId": params["productId"],
                    "factor": factor,
                    "simulatedAt": simulated_at,
                },
            )

        if dtype is DisruptionType.INVENTORY_DROP:
            factor = float(params.get("factor", 0.5))
            if factor <= 0.0 or factor >= 1.0:
                raise SimulationError("inventory_drop factor must be in (0, 1)")
            return self._client.run_write(
                APPLY_INVENTORY_DROP,
                {
                    "scenarioId": scenario_id,
                    "factor": factor,
                    "warehouseId": params.get("warehouseId"),
                    "productId": params.get("productId"),
                    "simulatedAt": simulated_at,
                },
            )

        if dtype is DisruptionType.COST_INCREASE:
            factor = float(params.get("factor", 1.3))
            if factor <= 1.0:
                raise SimulationError("cost_increase factor must be > 1.0")
            return self._client.run_write(
                APPLY_COST_INCREASE,
                {
                    "scenarioId": scenario_id,
                    "factor": factor,
                    "routeId": params.get("routeId"),
                    "mode": params.get("mode"),
                    "simulatedAt": simulated_at,
                },
            )

        raise SimulationError(f"Unknown disruption type: {dtype}")

    @staticmethod
    def _require(params: dict[str, Any], key: str) -> None:
        if key not in params or params[key] in (None, ""):
            raise SimulationError(f"Missing required param: {key}")

    @staticmethod
    def _auto_description(dtype: DisruptionType, params: dict[str, Any]) -> str:
        if dtype is DisruptionType.SUPPLIER_DOWN:
            return f"Supplier {params.get('supplierId')} is offline"
        if dtype is DisruptionType.ROUTE_BLOCKED:
            return f"Route {params.get('routeId')} is blocked"
        if dtype is DisruptionType.DEMAND_SPIKE:
            return f"Demand spike for product {params.get('productId')} factor={params.get('factor')}"
        if dtype is DisruptionType.INVENTORY_DROP:
            return f"Inventory drop factor={params.get('factor')}"
        if dtype is DisruptionType.COST_INCREASE:
            return f"Cost increase factor={params.get('factor')}"
        return "Disruption"
