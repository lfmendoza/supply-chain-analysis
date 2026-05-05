# Backend

FastAPI service that exposes:

- `/health` and `/health/neo4j` — liveness and AuraDB connectivity.
- `/graph/...`, `/products/...`, `/suppliers/...`, `/orders/...`,
  `/materials/...`, `/analysis/...` — Cypher-backed queries.
- `/simulation/...` — create / list / inspect / revert disruption scenarios.
- `/optimization/run` — run the OR-Tools CP-SAT solver and persist results.
- `/optimization/scenarios/{id}/comparison` — KPI comparison between
  base / disrupted / optimized states.
- `/ml/supplier-risk` and `/ml/supplier-risk/train` — supplier risk scoring.

## Module layout

```
app/
  config.py                Settings loaded from .env
  db/
    neo4j_client.py        Reusable driver wrapper (singleton)
    queries/graph_queries  Cypher templates used by the API
  api/                     FastAPI routers
  simulation/              Disruption engine and scenario types
  optimization/            Loader -> CP-SAT solver -> writeback
  analysis/kpis.py         Comparison endpoint and KPIs
  ml/                      Feature extraction, training, prediction
```

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
cp ../.env.example .env     # then edit with real Aura credentials
uvicorn app.main:app --reload
```

## Tests

(Pytest layout under `tests/`; add tests as needed.)
