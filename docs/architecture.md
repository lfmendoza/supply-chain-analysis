# Architecture

## Components

- **Neo4j AuraDB** — primary data store, holds the topology, inventory,
  orders, scenarios and optimization results.
- **FastAPI backend** (Python 3.11+) — gateway between the UI and Neo4j /
  OR-Tools / scikit-learn. Imports the official Neo4j driver and exposes a
  reusable `Neo4jClient` singleton.
- **OR-Tools CP-SAT solver** — runs in-process inside the backend. Inputs
  come from Neo4j via `app.optimization.data_loader`, outputs are persisted
  via `app.optimization.writeback`.
- **scikit-learn RandomForest** — small classifier living under
  `app/ml/`. It pulls features from Neo4j, persists a joblib artifact, and
  pushes new `riskScore` values back into the graph.
- **React dashboard** — Vite + Tailwind. Talks to the backend via `/api`.

## Diagram

```mermaid
flowchart LR
    User[Usuario/Profesor] -->|Browser| FE[React Dashboard]
    FE -->|REST/JSON| API[FastAPI Backend]
    API -->|Cypher| Neo[(Neo4j AuraDB)]
    API -->|matrices| OPT[OR-Tools Solver]
    API -->|features| ML[scikit-learn Risk Model]
    ML -->|riskScore| Neo
    OPT -->|assignment| Neo
    DataGen[generate_dataset.py + seed_graph.py] -->|bulk MERGE| Neo
    NeoBrowser[Neo4j Browser] -.exploración demo.-> Neo
```

## Request flow for a typical demo cycle

```mermaid
sequenceDiagram
    participant FE as React UI
    participant API as FastAPI
    participant NEO as Neo4j AuraDB
    participant ORT as CP-SAT
    FE->>API: GET /graph/summary
    API->>NEO: TOPOLOGY_NODES + TOPOLOGY_EDGES
    NEO-->>API: rows
    API-->>FE: { counts, nodes, edges }

    FE->>API: POST /simulation/run { type, params }
    API->>NEO: CREATE :DisruptionScenario + apply Cypher + IMPACTS
    NEO-->>API: scenarioId
    API-->>FE: { scenarioId, impacts }

    FE->>API: POST /optimization/run { scenarioId }
    API->>NEO: pull pending orders, inventory, warehouses, paths
    API->>ORT: build CP-SAT model + solve
    ORT-->>API: assignment + objective + runtime
    API->>NEO: persist :OptimizedAssignment + RECOMMENDED edges
    API-->>FE: assignments

    FE->>API: GET /optimization/scenarios/{id}/comparison
    API->>NEO: rebuild base / disrupted greedy + read optimized
    NEO-->>API: rows
    API-->>FE: { base, disrupted, optimized, deltas }
```

## Boundaries / why each piece is separate

- Anything **descriptive** ("what depends on what", "what alternatives
  exist", "what becomes unreachable") lives in **Cypher**.
- Anything **prescriptive** ("which warehouse should fulfil this order
  given inventory and capacity") lives in **OR-Tools**.
- Anything **predictive** ("how risky is this supplier given history") lives
  in **scikit-learn**.

This separation is the academic spine of the project. Mixing them into a
single layer would defeat the rationale for using a graph database in the
first place.
