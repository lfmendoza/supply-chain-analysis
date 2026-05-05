"""ML endpoints for supplier risk scoring."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.neo4j_client import Neo4jClientError
from app.ml.predict import predict_and_update
from app.ml.train import train

router = APIRouter(prefix="/ml", tags=["ml"])


@router.post("/supplier-risk/train", summary="Train the supplier risk model from the current graph")
def train_supplier_risk() -> dict:
    try:
        report = train()
    except Neo4jClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {
        "samples": report.samples,
        "positives": report.positives,
        "accuracy": report.accuracy,
        "auc": report.auc,
        "featureImportance": report.feature_importance,
    }


@router.get("/supplier-risk", summary="Predict and persist updated supplier risk scores")
def supplier_risk() -> dict:
    try:
        return predict_and_update()
    except Neo4jClientError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
