"""Train and persist a RandomForest classifier for supplier risk."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split

from app.ml.features import FEATURE_COLUMNS, fetch_features, synthetic_label


ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "supplier_risk_rf.joblib"


@dataclass
class TrainingReport:
    samples: int
    positives: int
    accuracy: float
    auc: float | None
    feature_importance: dict[str, float]


def _ensure_dir() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def train(df: pd.DataFrame | None = None) -> TrainingReport:
    df = fetch_features() if df is None else df
    if df.empty:
        raise RuntimeError("No suppliers found; load the dataset first.")

    y = synthetic_label(df)
    X = df[FEATURE_COLUMNS]

    if y.nunique() < 2 or len(df) < 4:
        # Not enough variance; train on the whole set and skip metrics.
        clf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
        clf.fit(X, y)
        _ensure_dir()
        joblib.dump(clf, MODEL_PATH)
        return TrainingReport(
            samples=len(df),
            positives=int(y.sum()),
            accuracy=float("nan"),
            auc=None,
            feature_importance=dict(zip(FEATURE_COLUMNS, clf.feature_importances_.tolist())),
        )

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    clf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    try:
        auc = roc_auc_score(y_test, y_proba)
    except ValueError:
        auc = None

    _ensure_dir()
    joblib.dump(clf, MODEL_PATH)

    return TrainingReport(
        samples=len(df),
        positives=int(y.sum()),
        accuracy=float(acc),
        auc=float(auc) if auc is not None else None,
        feature_importance=dict(zip(FEATURE_COLUMNS, clf.feature_importances_.tolist())),
    )


def load_model():
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)
