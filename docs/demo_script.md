# Demo (~15 min)

**Prep:** AuraDB running; `python -m scripts.seed_graph --reset`; `python -m scripts.export_csv`; optional `python -m scripts.train_risk_model`; backend `uvicorn app.main:app --reload`; frontend `npm run dev`.

1. **Dashboard** — counts, connectivity, datatype coverage.
2. **Topology** — filters, search, property panel.
3. **Cypher** — presets (e.g. Q03, Q04, Q07); write mode only if needed.
4. **Operations** — new node (labels/types), `SUPPLIES` relationship, rewire, CSV tab, remove test node.
5. **Algorithms** — PageRank, betweenness, communities, shortest path.
6. **Simulation → Optimization → Comparison** — scenario, solver, charts.
7. **Rubric** — in-app matrix; static copy in [`rubric.md`](rubric.md).

**If something breaks:** check Neo4j connectivity; run centrality persistence first if the algorithms view is slow; revert the scenario if the solver is infeasible.

## Notes (Q&A)

- **Graph vs recursive SQL:** Multi-hop patterns are usually simpler in Cypher; the subgraph can also be projected to NetworkX for analysis.
- **Everything in Cypher?** Global decision variables and capacities are a poor fit; the optimizer lives outside Cypher (OR-Tools).
- **Why NetworkX?** Aura Free has no GDS; NetworkX covers PageRank, betweenness, Louvain, and Dijkstra at this graph size.
