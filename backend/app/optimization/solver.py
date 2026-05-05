"""CP-SAT formulation: assign customer orders to warehouses.

Decision variables
------------------
    x[o, w] in {0, 1}  : 1 if order o is fulfilled from warehouse w.
    u[o]    in {0, 1}  : 1 if order o is left unfulfilled (escape variable).

Constraints
-----------
    1. Each order is assigned exactly once OR explicitly unfulfilled:
       sum_w x[o, w] + u[o] = 1  for all o
    2. Inventory must cover what is assigned:
       sum_o x[o, w] * q[o] * 1{prod[o] = p} <= inv[w, p]
    3. Warehouse dispatch capacity:
       sum_o x[o, w] * q[o] <= capacity[w]
    4. Pre-filters: x[o, w] = 0 if inventory insufficient or path infeasible.

Objective (minimize)
--------------------
    sum_(o, w) x[o, w] * (alpha*cost[w,o] + beta*leadTime[w,o] + gamma*risk[w,o])
    + sum_o u[o] * (delta * revenue[o] * priority_weight[o])

Floats are scaled to integers (multiplied by `SCALE`) because CP-SAT requires
integer coefficients.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from app.optimization.data_loader import OptimizationData


# Default weights, tunable per request.
DEFAULT_ALPHA = 1.0     # cost
DEFAULT_BETA = 10.0     # leadTime (days)
DEFAULT_GAMMA = 50.0    # risk (0..1)
DEFAULT_DELTA = 5.0     # unfulfilled penalty multiplier on revenue
SCALE = 1000            # float -> int scaling factor


@dataclass
class SolverWeights:
    alpha: float = DEFAULT_ALPHA
    beta: float = DEFAULT_BETA
    gamma: float = DEFAULT_GAMMA
    delta: float = DEFAULT_DELTA


@dataclass
class Assignment:
    order_id: str
    warehouse_id: str
    cost: float
    lead_time: int
    risk: float


@dataclass
class SolverResult:
    status: str
    objective_value: float
    runtime_ms: int
    assignments: list[Assignment]
    unfulfilled_order_ids: list[str]
    weights: SolverWeights
    diagnostics: dict[str, float] = field(default_factory=dict)


def _priority_weight(priority: int) -> int:
    # 1 (high) -> 3, 2 -> 2, 3 -> 1
    return max(1, 4 - priority)


def solve(data: OptimizationData, weights: SolverWeights | None = None, time_limit_s: int = 10) -> SolverResult:
    weights = weights or SolverWeights()
    model = cp_model.CpModel()

    orders = data.orders
    warehouses = data.warehouses

    # Variables.
    x: dict[tuple[str, str], cp_model.IntVar] = {}
    u: dict[str, cp_model.IntVar] = {}

    for o in orders:
        u[o.order_id] = model.NewBoolVar(f"u_{o.order_id}")
        for w in warehouses:
            v = model.NewBoolVar(f"x_{o.order_id}_{w.warehouse_id}")
            x[(o.order_id, w.warehouse_id)] = v
            if not data.feasible.get((w.warehouse_id, o.order_id), False):
                model.Add(v == 0)

    # Constraint 1: assignment exclusivity.
    for o in orders:
        model.Add(sum(x[(o.order_id, w.warehouse_id)] for w in warehouses) + u[o.order_id] == 1)

    # Constraint 2: inventory by (warehouse, product).
    products = {o.product_id for o in orders}
    for w in warehouses:
        for p in products:
            inv_qty = data.inventory.get((w.warehouse_id, p), 0)
            assigned = [
                x[(o.order_id, w.warehouse_id)] * o.quantity
                for o in orders
                if o.product_id == p
            ]
            if assigned:
                model.Add(sum(assigned) <= inv_qty)

    # Constraint 3: warehouse dispatch capacity.
    for w in warehouses:
        total = [x[(o.order_id, w.warehouse_id)] * o.quantity for o in orders]
        if total:
            model.Add(sum(total) <= int(w.capacity))

    # Objective (everything scaled to integer).
    obj_terms: list[cp_model.IntVar] = []
    for o in orders:
        for w in warehouses:
            cost_w = data.cost.get((w.warehouse_id, o.order_id), 0.0)
            lt_w = data.lead_time.get((w.warehouse_id, o.order_id), 0)
            risk_w = data.risk.get((w.warehouse_id, o.order_id), 0.0)
            if cost_w == float("inf"):
                continue
            coeff = (
                weights.alpha * cost_w
                + weights.beta * lt_w
                + weights.gamma * risk_w * SCALE  # risk in 0..1 -> bring up to similar magnitude
            )
            obj_terms.append(int(coeff) * x[(o.order_id, w.warehouse_id)])
        # Unfulfilled penalty.
        unfulfilled_pen = int(weights.delta * (o.revenue or 0) * _priority_weight(o.priority))
        obj_terms.append(unfulfilled_pen * u[o.order_id])

    model.Minimize(sum(obj_terms))

    # Solve.
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_search_workers = 4

    started = time.perf_counter()
    status = solver.Solve(model)
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    status_name = solver.StatusName(status)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResult(
            status=status_name,
            objective_value=0.0,
            runtime_ms=elapsed_ms,
            assignments=[],
            unfulfilled_order_ids=[o.order_id for o in orders],
            weights=weights,
            diagnostics={"orders": len(orders), "warehouses": len(warehouses)},
        )

    assignments: list[Assignment] = []
    unfulfilled: list[str] = []
    for o in orders:
        if solver.Value(u[o.order_id]) == 1:
            unfulfilled.append(o.order_id)
            continue
        for w in warehouses:
            if solver.Value(x[(o.order_id, w.warehouse_id)]) == 1:
                assignments.append(
                    Assignment(
                        order_id=o.order_id,
                        warehouse_id=w.warehouse_id,
                        cost=round(data.cost.get((w.warehouse_id, o.order_id), 0.0), 2),
                        lead_time=int(data.lead_time.get((w.warehouse_id, o.order_id), 0)),
                        risk=round(data.risk.get((w.warehouse_id, o.order_id), 0.0), 4),
                    )
                )
                break

    return SolverResult(
        status=status_name,
        objective_value=float(solver.ObjectiveValue()),
        runtime_ms=elapsed_ms,
        assignments=assignments,
        unfulfilled_order_ids=unfulfilled,
        weights=weights,
        diagnostics={
            "orders": float(len(orders)),
            "warehouses": float(len(warehouses)),
            "assigned": float(len(assignments)),
            "unfulfilled": float(len(unfulfilled)),
        },
    )
