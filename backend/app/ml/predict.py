"""Compute updated supplier risk scores and write them back into Neo4j."""

from __future__ import annotations

from app.db.neo4j_client import Neo4jClient, get_neo4j_client
from app.ml.features import FEATURE_COLUMNS, fetch_features
from app.ml.train import load_model, train


UPDATE_RISK = """
UNWIND $rows AS row
MATCH (s:Supplier {id: row.supplierId})
SET s.riskScore = row.riskScore
"""


def predict_and_update(client: Neo4jClient | None = None) -> dict:
    cli = client or get_neo4j_client()
    model = load_model()
    if model is None:
        # Train on the fly with the current graph state.
        train()
        model = load_model()
        assert model is not None

    df = fetch_features(cli)
    if df.empty:
        return {"updated": 0, "rows": []}

    proba = model.predict_proba(df[FEATURE_COLUMNS])[:, 1]
    df["riskScore"] = proba.round(4)
    rows = [{"supplierId": r.supplierId, "riskScore": float(r.riskScore)} for r in df.itertuples()]
    cli.run_write(UPDATE_RISK, {"rows": rows})

    return {
        "updated": len(rows),
        "rows": [
            {
                "supplierId": r["supplierId"],
                "riskScore": r["riskScore"],
            }
            for r in rows
        ],
    }
