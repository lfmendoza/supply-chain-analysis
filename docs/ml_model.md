# Machine learning component: supplier risk scoring

## Goal

Replace hand-tuned `Supplier.riskScore` (0..1) with a `RandomForestClassifier` so the pipeline can refresh scores from the graph:

> Graph → features → ML model → updated `riskScore` → optimizer → graph.

## Why this and not something else

- The output is a number that drops into the optimizer's objective directly
  (`gamma * risk[w, o]`), so ML changes the resulting assignment in a
  measurable way.
- All features are derivable from the same graph, so we don't introduce
  another data store.
- A small Random Forest is interpretable (we expose `featureImportance` in
  the API) and converges in milliseconds.

## Features

| Feature | Source |
|---|---|
| `avgLeadTime` | average of `(:Supplier)-[:SUPPLIES]-> {leadTimeDays}`. |
| `avgDelayDays` | average of `Shipment.delayDays` reachable from the supplier. |
| `disruptionCount` | count of incoming `IMPACTS` edges (how often it has been part of a disruption). |
| `singleSourceCount` | raw materials where this supplier is the only active provider. |
| `degreeCentrality` | number of distinct raw materials supplied. |
| `countryRiskIndex` | hand-curated lookup table by country. |

## Target (synthetic)

Because we don't have ground-truth labels, we generate a deterministic label
from a weighted blend of the features plus a tiny per-supplier noise. This
is not "real" ground truth and we document it as such, but it lets the
classifier learn a non-trivial decision boundary while remaining fully
reproducible.

## Model

`RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)`.

Output of `predict_proba(X)[:, 1]` is mapped to `Supplier.riskScore`.

## Pipeline

1. `python -m scripts.train_risk_model` — extracts features from Neo4j,
   trains, persists `backend/app/ml/artifacts/supplier_risk_rf.joblib`.
2. `GET /ml/supplier-risk` — reuses the persisted model (training on the fly
   if missing), recomputes features for current suppliers, and writes the
   new `riskScore` back into Neo4j.
3. The next invocation of `POST /optimization/run` reads the updated
   `Supplier.riskScore`, so the optimizer's solution can change visibly.

## How to verify the loop closes

1. Run the optimizer for a scenario, note the assignments.
2. Hit `GET /ml/supplier-risk`.
3. Run the optimizer again.
4. The `riskScore` of suppliers feeding the at-risk products will have
   shifted, and the assignment for any borderline order should change.

## When to disable

If training is unstable (e.g. when running with a brand-new dataset that has
fewer than 4 suppliers), the API falls back to a model trained on the entire
sample and skips train/test metrics. The pipeline never blocks the rest of
the project.
