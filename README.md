# Supply Chain Network Analysis & Optimization

**Database 2** course project: supply chain as a **Neo4j AuraDB** graph, CRUD from the UI, saved Cypher presets and a free editor, **PageRank / Betweenness / Louvain / Dijkstra** via NetworkX, disruption simulation, order-to-warehouse assignment with **OR-Tools CP-SAT**, and supplier risk with **scikit-learn**.

```text
                           +--> NetworkX (PageRank / Betweenness / Louvain / Dijkstra)
                           |
Graph (Neo4j) --> Features --> ML (riskScore) --> Optimizer (OR-Tools) --> Graph (Neo4j)
                            \                                          ^
                             +--> Simulation engine ---------------- ---+
```

## Why this stack

- **Neo4j**: native multi-hop traceability, alternative-supplier lookups,
  single-source detection, blocked-route impact — all natural in Cypher,
  awkward in SQL. Native datatypes (`Boolean`, `Date`, `DateTime`,
  `List`, `Point`) are exercised by the dataset.
- **NetworkX (in process)**: Aura Free does not include the GDS plugin, so
  we run the usual Python graph algorithms and either return them
  to the UI or persist scores back into the graph.
- **OR-Tools (CP-SAT)**: real combinatorial optimization with capacity,
  inventory and a multi-objective function — what Cypher cannot express.
- **scikit-learn**: RandomForest that refreshes `riskScore` on suppliers.
- **FastAPI + React + Vite + Tailwind + Cytoscape.js + Plotly**

## Repository layout

```
backend/      FastAPI service (Neo4j client, simulation, optimization, ML, KPIs, algorithms)
cypher/       Cypher constraints + the original ten KPI queries
data/         JSON dataset built by scripts/generate_dataset.py
data/csv/     CSV demo files used by the Operations Lab CSV upload
docs/         Architecture, data model, optimization, ML, algorithms, rubric, demo script
frontend/     React + Vite dashboard (Dashboard, Topology, Cypher Explorer, Operations Lab,
              Algorithms, Simulation, Optimization, Comparison, Rubric Matrix)
scripts/      Generator, seeder, connection check, ML training, smoke tests, CSV exporter
```

## Prerequisites

- Python **3.11+**
- Node.js **18+**
- A free [Neo4j AuraDB](https://console.neo4j.io) instance

## 1. AuraDB credentials

1. Sign in at <https://console.neo4j.io>.
2. Create a free instance (`neo4j 5.x` is fine).
3. Save the auto-generated password (it is only shown once) and the
   connection URI (looks like `neo4j+s://xxxxxxxx.databases.neo4j.io`).
4. Wait until the instance status reads **Running**.

## 2. Configure environment

Copy the example file and fill in real values:

```bash
cp .env.example backend/.env
# edit backend/.env with your AuraDB URI / username / password / database
```

Optional toggle for the Cypher Explorer in shared deployments:

```ini
ALLOW_CYPHER_WRITE=true   # default; set to false to disable write mode in /cypher/execute
```

`backend/.env` is git-ignored. Never commit real credentials.

## 3. Backend setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Verify the connection:

```bash
cd ..
python -m scripts.check_connection
```

Expected output:

```
OK -> Neo4j AuraDB connection successful
```

> **Windows TLS gotcha**: AuraDB's TLS certificate is currently issued by
> SSL.com, whose roots are not always in the Windows certificate store. The
> Neo4j driver therefore fails with a generic
> `ServiceUnavailable: Unable to retrieve routing information`. The
> `Neo4jClient` works around this by injecting an `SSLContext` built from
> the [`certifi`](https://pypi.org/project/certifi/) bundle, so things just
> work. To debug TLS directly run `python -m scripts.tls_probe`; for a
> deeper diagnostic run `python -m scripts.diagnose_connection`.

Seed the graph with synthetic data (idempotent and includes all 8 Neo4j
datatypes):

```bash
python -m scripts.seed_graph --reset
```

Export the demo CSVs (used by the Operations Lab):

```bash
python -m scripts.export_csv
```

Train the ML model (optional but recommended before demo):

```bash
python -m scripts.train_risk_model
```

Start the API:

```bash
cd backend
uvicorn app.main:app --reload
```

Swagger UI: <http://localhost:8000/docs>

## 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Visit <http://localhost:5173>. The Vite dev server proxies `/api` to
<http://localhost:8000>.

## 5. Suggested walkthrough

See [`docs/demo_script.md`](docs/demo_script.md) and [`docs/rubric.md`](docs/rubric.md).

1. **Dashboard** (`/`)
2. **Topology** (`/topology`)
3. **Cypher** (`/queries`)
4. **Operations** (`/operations`) — nodes, relationships, CSV
5. **Algorithms** (`/algorithms`)
6. **Simulation** (`/simulation`)
7. **Optimization** (`/optimization`)
8. **Comparison** (`/comparison`)
9. **Rubric** (`/rubric`)

## Smoke tests

The repo ships four end-to-end smoke tests that hit every layer:

```bash
python -m scripts.smoke_test     # ML + simulation + optimization + comparison
python -m scripts.test_phase1    # CRUD + Cypher executor + connectivity + datatypes
python -m scripts.test_phase2    # PageRank, Betweenness, Communities, Shortest path
python -m scripts.test_phase4    # CSV upload (nodes + relationships)
```

All four should print `*** PASSED.` at the bottom.

## Security

- `.env`, `backend/.env` and `frontend/.env*` are git-ignored.
- Credentials are never logged. The `Settings.safe_repr()` helper omits the
  password.
- The Cypher Explorer defaults to **read-only** sessions; switching to
  write requires an explicit confirmation in the UI and respects the
  `ALLOW_CYPHER_WRITE` env flag.
- If a secret is ever pasted in a terminal screenshot or chat, rotate the
  AuraDB password from the console immediately.

## License

MIT — see top of `backend/pyproject.toml`.
