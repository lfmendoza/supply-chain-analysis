# Demo script (10–12 minutes)

Goal: convince the professor that **Neo4j is the right tool** for the
analytical questions, that **OR-Tools complements it** for combinatorial
optimization, and that the system measurably improves the situation after a
disruption.

## Before the demo

1. Confirm AuraDB is *Running*.
2. `python -m scripts.seed_graph --reset` — clean dataset.
3. `python -m scripts.train_risk_model` — model artifact ready.
4. `uvicorn app.main:app --reload` — backend on 8000.
5. `npm run dev` (frontend) — UI on 5173.
6. Open Neo4j Browser side-by-side for live Cypher.

## Story arc

| Step | Action | Talking point |
|---|---|---|
| 1 | Open `/` (Topology). | "This is our supply chain modelled as a graph." |
| 2 | Show node counts cards. | "8 suppliers, 15 products, 5 warehouses, 50 pending orders." |
| 3 | Open Neo4j Browser, run **Q01** with `$productId = "P2"`. | "One Cypher query gives the full traceability — in SQL this would be a 5-table join." |
| 4 | Run **Q05** with `$rawMaterialId = "RM-A"`. | "Only one active supplier — single point of failure." |
| 5 | Run **Q07** in Browser. | "RM-A is critical. P2, P3, P5, P7, P8, P11, P13 depend on it." |
| 6 | Open `/simulation`, pick `supplier_down (S3)`, click *Run*. | "Let's break exactly the worst supplier. The new node `DisruptionScenario` materializes the impact via `IMPACTS` edges." |
| 7 | Back to Neo4j Browser run **Q02** with `$supplierId = "S3"`. | "These are the products immediately affected. CRITICAL = no alternative." |
| 8 | Run **Q09** in Browser. | "Aggregated: N orders cannot be fulfilled, USD M at risk." |
| 9 | Open `/optimization`, click *Re-score supplier risk (ML)*. | "ML reads fresh features from the graph and rewrites `riskScore`." |
| 10 | Click *Run optimization*. | "Cypher cannot solve this. We have 50 orders, 5 warehouses, with inventory and capacity constraints, and a multi-objective function. CP-SAT proves optimality in under a second." |
| 11 | Open `/comparison`, pick the scenario, click *Compute*. | "Here is the proof: cost recovered, orders recovered, fulfilment rate up, lead time down." |
| 12 | Close. | "Neo4j answered *what is connected and what breaks*. OR-Tools answered *what to do about it*. ML closed the loop by re-scoring suppliers from the graph itself." |

## Backup plan if something fails

- **Neo4j unreachable:** show pre-recorded screenshots in `docs/screenshots/`.
- **GDS plugin missing:** all key queries use plain Cypher (we never relied
  on GDS for the demo path).
- **Solver returns infeasible:** revert the scenario (button on the
  Simulation page) and rerun with a smaller disruption (`inventory_drop`
  factor 0.7 instead of 0.5).

## Talking points the professor will probe

> "Why not Postgres with recursive CTEs?"
- Recursion in SQL is awkward, slower for variable-length paths and harder
  to maintain. Aura also offers GDS, centrality, etc. as native operations.

> "Why not solve everything with Cypher?"
- Cypher is declarative pattern-matching, not a constraint solver. There is
  no concept of decision variables or capacity constraints. The greedy
  fallback we computed in `_greedy_fulfil` (KPIs file) is exactly the
  *upper bound* a Cypher-only approach can deliver.

> "Why CP-SAT and not a MIP?"
- The problem is small and has a clean linear objective. Both work; CP-SAT
  is bundled with OR-Tools, deals well with logical constraints, and is
  simpler to instantiate in Python.

> "How realistic is the dataset?"
- Synthetic but consistency-checked. Designed deliberately to stress the
  single-source / blocked-route / inventory shortage cases that make for a
  meaningful demo.

> "Where is the multi-hop value clearest?"
- Q08 (blocked route impact) and Q10 (raw material to end customer): both
  rely on variable-length patterns `*1..N` that Cypher handles natively.
