"""End-to-end smoke test: simulate -> optimize -> compare -> revert.

Run after `seed_graph.py` to verify every component works against the live
AuraDB instance. Prints summary metrics for each stage.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.analysis.kpis import comparison  # noqa: E402
from app.ml.predict import predict_and_update  # noqa: E402
from app.optimization.data_loader import DataLoader  # noqa: E402
from app.optimization.solver import solve  # noqa: E402
from app.optimization.writeback import persist  # noqa: E402
from app.simulation.engine import SimulationEngine  # noqa: E402
from app.simulation.scenarios import DisruptionType  # noqa: E402


def _run_optimization(scenario_id: str | None) -> dict:
    data = DataLoader().load()
    result = solve(data)
    assignment_id = persist(result, scenario_id)
    return {
        "assignmentId": assignment_id,
        "status": result.status,
        "objective": result.objective_value,
        "runtimeMs": result.runtime_ms,
        "assigned": len(result.assignments),
        "unfulfilled": len(result.unfulfilled_order_ids),
    }


def main() -> int:
    print("=" * 70)
    print("STEP 1 - Re-score supplier risk with the trained ML model")
    print("=" * 70)
    ml_result = predict_and_update()
    for row in ml_result["rows"]:
        print(f"  {row['supplierId']}: riskScore={row['riskScore']}")

    print("\n" + "=" * 70)
    print("STEP 2 - Apply disruption: supplier_down(S3)")
    print("=" * 70)
    engine = SimulationEngine()
    sim = engine.apply(DisruptionType.SUPPLIER_DOWN, {"supplierId": "S3"})
    print(f"  scenarioId   = {sim['scenarioId']}")
    print(f"  description  = {sim.get('params')}")
    print(f"  impacts      = {sim['impacts']}")

    print("\n" + "=" * 70)
    print("STEP 3 - Run optimization")
    print("=" * 70)
    opt = _run_optimization(sim["scenarioId"])
    for k, v in opt.items():
        print(f"  {k:<14} = {v}")

    print("\n" + "=" * 70)
    print("STEP 4 - Comparison (base / disrupted / optimized)")
    print("=" * 70)
    cmp = comparison(sim["scenarioId"])
    for state in ("base", "disrupted", "optimized"):
        m = cmp[state]
        print(f"  {state:<10} cost=${m['totalCost']:>9.2f}  fulfilment={m['fulfillmentPct']:>5.1f}%  "
              f"affected={m['ordersAffected']:>3}  avgLeadTime={m['avgLeadTime']:>5.2f}d")
    print("  deltas:")
    for k, v in cmp["deltas"].items():
        print(f"    {k:<24} = {v}")

    print("\n" + "=" * 70)
    print("STEP 5 - Revert disruption")
    print("=" * 70)
    rev = engine.revert(sim["scenarioId"])
    print(f"  {rev}")

    print("\nSmoke test PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
