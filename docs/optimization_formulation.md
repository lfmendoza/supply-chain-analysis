# Optimization formulation: order-to-warehouse assignment

This document describes the integer programming model used by the OR-Tools
CP-SAT solver to assign pending customer orders to active warehouses while
respecting inventory and dispatch capacity, and minimizing a weighted
combination of cost, lead time and risk.

## Sets

| Symbol | Meaning |
|---|---|
| `O`  | Pending customer orders (`status = 'pending'`). |
| `W`  | Active warehouses (those reachable in the current scenario). |
| `P`  | Distinct products in the open orders. |

## Parameters (extracted from Neo4j)

| Symbol | Meaning | Source |
|---|---|---|
| `q[o]`         | Quantity ordered by `o`. | `(co)-[:FOR_PRODUCT]->(p)` quantity property. |
| `prod[o]`      | Product of order `o`. | `(co)-[:FOR_PRODUCT]->(p)` |
| `inv[w, p]`    | Inventory of product `p` in warehouse `w`. | `(w)-[:HAS_INVENTORY]->(:Inventory)-[:OF_PRODUCT]->(p)` |
| `cost[w, o]`   | Shipping cost from `w` to the customer of `o`. | weighted shortest path on `CONNECTED_TO`. |
| `leadTime[w, o]` | Total leadTime in days for that path. | sum of `leadTimeDays` along path. |
| `risk[w, o]`   | Aggregate risk in `[0, 1]`. | mean of `(1 - reliabilityScore)` of carriers in path, blended with average `riskScore` of suppliers feeding `prod[o]`. |
| `capacity[w]`  | Dispatch capacity per period of `w`. | `Warehouse.dispatchCapacityPerWeek` |
| `priority[o]`  | Priority class. | `CustomerOrder.priority` (1=high, 2=med, 3=low). |
| `revenue[o]`   | Revenue at stake. | `CustomerOrder.revenue` |

## Decision variables

- `x[o, w] ∈ {0, 1}` : 1 if order `o` is fulfilled from warehouse `w`.
- `u[o] ∈ {0, 1}`    : 1 if order `o` is left unfulfilled (escape variable).

## Constraints

1. **Assignment exclusivity**

   `Σ_w x[o, w] + u[o] = 1` for all `o`.

2. **Inventory adequacy**

   `Σ_o (x[o, w] · q[o] · 1{prod[o] = p}) ≤ inv[w, p]` for all `w, p`.

3. **Warehouse dispatch capacity**

   `Σ_o x[o, w] · q[o] ≤ capacity[w]` for all `w`.

4. **Pre-filters (handled at variable creation)**:
   - `x[o, w] = 0` if `inv[w, prod[o]] < q[o]`.
   - `x[o, w] = 0` if there is no open path between `w.location` and `customer.location`.

## Objective (minimize)

```
Σ_(o, w) x[o, w] · (α·cost[w, o] + β·leadTime[w, o] + γ·risk[w, o])
+ Σ_o u[o] · (δ · revenue[o] · priorityWeight(priority[o]))
```

Defaults: α = 1.0 (cost in currency), β = 10.0 (one day = 10 currency units),
γ = 50.0 · 1000 (risk in `[0, 1]` scaled to similar magnitude as cost),
δ = 5.0 (penalty multiplier on revenue when an order is dropped).

`priorityWeight(p)` = `4 - p`, so high-priority orders carry a larger
penalty when left unfulfilled.

## Solver choice

We use OR-Tools **CP-SAT** because:

- Variables are binary and the objective is linear → MIP / CP-SAT both work.
- Logical constraints (e.g. forbidden pairs) read naturally in CP-SAT.
- For small instances (≤ 50 orders × 5 warehouses) CP-SAT solves to optimality
  in well under one second.

## Why not solve this purely with Cypher?

Cypher does not have decision variables, capacity constraints aggregated
across rows, or a branch-and-bound search. The most we can do is a greedy
heuristic (e.g. assign each order to its cheapest warehouse with stock),
which gives no optimality guarantee and cannot balance the multi-objective
trade-off between cost, leadTime, risk and unfulfilment.

## Pipeline

1. `app.optimization.data_loader.DataLoader.load()` reads the inputs from
   Neo4j and computes shortest paths.
2. `app.optimization.solver.solve()` builds the CP-SAT model and returns a
   `SolverResult`.
3. `app.optimization.writeback.persist()` creates `OptimizedAssignment`
   nodes and `RECOMMENDED` / `ASSIGNED_TO` relationships.
