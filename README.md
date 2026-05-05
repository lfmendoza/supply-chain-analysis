# Supply Chain Network Analysis & Optimization

Academic MVP for the Database 2 course. The system models a supply chain as a
**graph in Neo4j AuraDB**, simulates disruptions, optimizes
order-to-warehouse assignment with **OR-Tools CP-SAT**, scores supplier risk
with a small **scikit-learn** model, and visualises the before / after with a
**React** dashboard.

```text
Graph (Neo4j) --> Features --> ML (riskScore) --> Optimizer (OR-Tools) --> Graph (Neo4j)
                            \\                                      ^
                             +--> Simulation engine ----------------+
```

## Why this stack

- **Neo4j**: native multi-hop traceability, alternative-supplier lookups,
  single-source detection, blocked-route impact — all natural in Cypher,
  awkward in SQL.
- **OR-Tools (CP-SAT)**: real combinatorial optimization with capacity,
  inventory, multi-objective cost / lead time / risk — anything Cypher
  cannot express as a constrained minimization.
- **scikit-learn**: small RandomForest that closes the loop by feeding the
  graph with updated `riskScore`s.
- **FastAPI + React + Tailwind + Plotly + react-force-graph**: simple,
  professional and demo-ready.

## Repository layout

```
backend/      FastAPI service (Neo4j client, simulation, optimization, ML, KPIs)
cypher/       Cypher constraints + the 10 demo queries
data/         Generated dataset JSONs (created by scripts/generate_dataset.py)
docs/         Architecture, data model, optimization formulation, ML model, demo script
frontend/     React + Vite dashboard (Topology, Traceability, Simulation, Optimization, Comparison)
scripts/      Generator, seeder, connection check, ML training
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- A free [Neo4j AuraDB](https://console.neo4j.io) instance

## 1. AuraDB credentials

1. Sign in at <https://console.neo4j.io>.
2. Create a free instance (`neo4j 5.x` is fine).
3. Save the auto-generated password (it is only shown once) and the
   connection URI (looks like `neo4j+s://xxxxxxxx.databases.neo4j.io`).
4. Wait until the instance status reads `Running`.

## 2. Configure environment

Copy the example file and fill in real values:

```bash
cp .env.example backend/.env
# edit backend/.env with your AuraDB URI and password
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

Seed the graph with synthetic data (idempotent):

```bash
python -m scripts.seed_graph --reset
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

## 5. End-to-end demo flow

1. **Topology** — open `/`, see the supply chain rendered as a force graph
   with KPI cards.
2. **Traceability** — open `/traceability`, run the 4 multi-hop Cypher
   queries (Q01, Q05, Q07, Q09).
3. **Simulation** — open `/simulation`, pick `supplier_down (S3)`, click
   *Run disruption*.
4. **Optimization** — open `/optimization`, pick the new scenario, click
   *Run optimization*. Optionally click *Re-score supplier risk (ML)*
   beforehand to see how the assignment changes.
5. **Comparison** — open `/comparison`, pick the scenario, see the
   `base / disrupted / optimized` table and Plotly charts.

A more detailed script lives in [`docs/demo_script.md`](docs/demo_script.md).

## Security

- `.env`, `backend/.env`, `frontend/.env*` are all in `.gitignore`.
- Credentials are never logged. The `Settings.safe_repr()` helper omits the
  password.
- If a secret is ever pasted in a terminal screenshot or chat, rotate the
  AuraDB password from the console immediately.

## License

MIT — see top of `backend/pyproject.toml`.
