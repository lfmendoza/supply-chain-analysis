"""Train the supplier risk Random Forest from the current Neo4j graph state."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.ml.train import train  # noqa: E402


def main() -> int:
    report = train()
    print("Training completed.")
    print(f"  samples            = {report.samples}")
    print(f"  positives          = {report.positives}")
    print(f"  accuracy           = {report.accuracy}")
    print(f"  auc                = {report.auc}")
    print("  feature importance:")
    for k, v in report.feature_importance.items():
        print(f"    {k:<22} {v:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
