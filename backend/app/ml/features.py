"""Feature extraction for supplier risk scoring.

All features come from the graph itself so we can demonstrate Neo4j as both
the source AND the sink of an ML pipeline:

  avg_delivery_delay_days   - mean Shipment.delayDays for shipments using a
                              route operated by a carrier whose role connects
                              to suppliers via raw materials.
  disruption_history_count  - number of IMPACTS edges historically created
                              against the supplier.
  single_source_materials   - raw materials this supplier is the only active
                              supplier of.
  country_risk_index        - lookup table per country (synthetic).
  avg_lead_time_days        - mean SUPPLIES.leadTimeDays.
  degree_centrality         - rough degree (count of materials it supplies).
"""

from __future__ import annotations

import pandas as pd

from app.db.neo4j_client import Neo4jClient, get_neo4j_client


COUNTRY_RISK_INDEX: dict[str, float] = {
    "JP": 0.10,
    "US": 0.20,
    "CN": 0.40,
    "MX": 0.45,
    "BR": 0.55,
    "CL": 0.65,
}


SUPPLIER_FEATURES = """
MATCH (s:Supplier)
OPTIONAL MATCH (s)-[su:SUPPLIES]->(rm:RawMaterial)
WITH s, collect(DISTINCT rm.id) AS materialIds, avg(su.leadTimeDays) AS avgLeadTime
OPTIONAL MATCH (ds:DisruptionScenario)-[:IMPACTS]->(s)
WITH s, materialIds, coalesce(avgLeadTime, 0.0) AS avgLeadTime, count(ds) AS disruptionCount
OPTIONAL MATCH (s)-[:SUPPLIES]->(rm:RawMaterial)
OPTIONAL MATCH (rm)<-[:SUPPLIES]-(other:Supplier {status: 'active'})
WITH s, materialIds, avgLeadTime, disruptionCount, rm, count(other) AS others
WITH s, materialIds, avgLeadTime, disruptionCount,
     sum(CASE WHEN others = 1 THEN 1 ELSE 0 END) AS singleSourceCount
OPTIONAL MATCH (po:PurchaseOrder)-[:SOURCED_FROM]->(s)
OPTIONAL MATCH (sh:Shipment)-[:USES_ROUTE]->(:Route)
WITH s, materialIds, avgLeadTime, disruptionCount, singleSourceCount, avg(coalesce(sh.delayDays, 0)) AS avgDelay
RETURN s.id AS supplierId,
       s.country AS country,
       s.riskScore AS currentRisk,
       size(materialIds) AS degreeCentrality,
       avgLeadTime AS avgLeadTime,
       disruptionCount AS disruptionCount,
       singleSourceCount AS singleSourceCount,
       avgDelay AS avgDelayDays
"""


def fetch_features(client: Neo4jClient | None = None) -> pd.DataFrame:
    cli = client or get_neo4j_client()
    rows = cli.run(SUPPLIER_FEATURES)
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["countryRiskIndex"] = df["country"].map(COUNTRY_RISK_INDEX).fillna(0.50)
    # Coerce types.
    for col in ("avgLeadTime", "avgDelayDays", "currentRisk"):
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    for col in ("degreeCentrality", "disruptionCount", "singleSourceCount"):
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)
    return df


FEATURE_COLUMNS = [
    "avgLeadTime",
    "avgDelayDays",
    "disruptionCount",
    "singleSourceCount",
    "degreeCentrality",
    "countryRiskIndex",
]


def synthetic_label(df: pd.DataFrame, threshold: float = 0.5) -> pd.Series:
    """Generate a deterministic synthetic label for training.

    Combines the features into a risk proxy, normalizes, applies a small
    deterministic perturbation by supplierId hash, and thresholds. This is
    not "real" ground truth (we don't have it) but it gives the model a
    learnable target while remaining honest in the documentation.
    """
    proxy = (
        0.30 * df["countryRiskIndex"]
        + 0.20 * (df["avgLeadTime"] / max(df["avgLeadTime"].max(), 1))
        + 0.20 * (df["avgDelayDays"] / max(df["avgDelayDays"].max(), 1))
        + 0.15 * (df["disruptionCount"] / max(df["disruptionCount"].max(), 1))
        + 0.15 * (df["singleSourceCount"] / max(df["singleSourceCount"].max(), 1))
    )
    # Deterministic noise.
    noise = df["supplierId"].apply(lambda s: (hash(s) % 1000) / 10000.0)
    score = (proxy + noise).clip(0, 1)
    return (score >= threshold).astype(int)
