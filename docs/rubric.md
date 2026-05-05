# Rubric matrix

Offline copy of `/rubric` (22 items, **110 points**).

| # | Criterion | Pts | Where it is demonstrated |
|---|-----------|----:|--------------------------|
| 1 | Nodes with labels and properties | 5 | [`docs/data_model.md`](data_model.md) · `/topology` |
| 2 | Relationships with properties | 5 | [`docs/data_model.md`](data_model.md) · `/operations` (Relationships tab) |
| 3 | All Neo4j data types (String/Integer/Float/Boolean/Date/DateTime/List/Point) | 5 | `Supplier.isCertified` (Boolean), `Supplier.certifications` (List), `Supplier.registeredOn` (Date), `Supplier.lastAuditAt` (DateTime), `Location.coords` (Point). `GET /analysis/data-types` reports coverage live. |
| 4 | CSV data ingestion | 5 | `/operations` → CSV Upload tab. Upload `data/csv/suppliers.csv`. |
| 5 | Pre-loaded data | 2 | `python -m scripts.seed_graph --reset` (idempotent MERGE pipeline) |
| 6 | Sufficient number of nodes | 2 | ~250 nodes after seed (Dashboard counter) |
| 7 | Connected graph | 1 | `GET /analysis/connectivity`, badge in Dashboard |
| 8 | Topic / theme of the model | 5 | Supply chain — Dashboard and `README.md` |
| 9 | Create node with 1 label | 5 | `/operations` → Nodes → "Create node" |
| 10 | Create node with 2+ labels | 5 | Same form, "Add another label" chip (`Supplier:Certified`) |
| 11 | Create node with properties (every type) | 5 | Typed property editor offers all 8 datatypes |
| 12 | Visualise nodes | 5 | `/topology` — Cytoscape view + property inspector |
| 13 | Update node properties | 5 | `/operations` Edit row → typed editor |
| 14 | Create relationship with properties | 5 | `/operations` → Relationships → "Create relationship" |
| 15 | Update relationship (type / direction / endpoints / properties) | 5 | Rewire dialog — re-creates with new wiring atomically |
| 16 | Delete nodes | 5 | `/operations` → Trash icon (DETACH DELETE with confirmation) |
| 17 | Delete relationships | 5 | `/operations` → Relationships → Trash icon |
| 18 | Delete properties from a node | 5 | PATCH `/graph/nodes/{id}` with `remove: [keys]` (UI + Cypher Explorer) |
| 19 | Delete properties from a relationship | 5 | PATCH `/graph/relationships/{id}` with `remove: [keys]` |
| 20 | Cypher queries (15) | 15 | `/queries` — 15 presets in 5 categories + free editor with read/write switch |
| 21 | Data Science algorithm(s) | 10 | `/algorithms` — PageRank, Betweenness, Louvain, Dijkstra (NetworkX); see [`docs/algorithms.md`](algorithms.md) |
| 22 | Outstanding interface | 5 | Nav, dashboard, Cytoscape, inspector, toasts, confirmations, matrix |

## Auto status

`/rubric` calls among others:

- `GET /analysis/connectivity`
- `GET /analysis/data-types`
- `GET /graph/summary`

Rows show **Auto-OK** when the API answer is unambiguous; everything else is checked manually in the UI.

## Quick validation

1. `python -m scripts.seed_graph --reset`
2. `python -m scripts.test_phase1`
3. `python -m scripts.test_phase2`
4. `python -m scripts.test_phase4`
5. Frontend: `/`, `/topology`, `/queries`, `/operations`, `/algorithms`, `/simulation`, `/optimization`, `/comparison`, `/rubric`
