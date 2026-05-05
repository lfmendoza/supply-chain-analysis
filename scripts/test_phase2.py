"""Smoke test for Phase 2 endpoints (graph algorithms)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def main() -> int:
    client = TestClient(app)

    print("STEP 1 - PageRank top 5")
    r = client.get("/algorithms/pagerank?topN=5")
    assert r.status_code == 200, r.text
    for row in r.json()["results"]:
        print(f"    {row['label']:<14} {row['id']:<10} score={row['score']}")

    print("\nSTEP 2 - Betweenness top 5")
    r = client.get("/algorithms/betweenness?topN=5")
    assert r.status_code == 200, r.text
    for row in r.json()["results"]:
        print(f"    {row['label']:<14} {row['id']:<10} score={row['score']}")

    print("\nSTEP 3 - Communities (Louvain)")
    r = client.get("/algorithms/communities")
    assert r.status_code == 200, r.text
    body = r.json()
    print(f"    modularity={body['modularity']}, total={body['totalCommunities']}")
    for c in body["communities"][:5]:
        print(f"    community {c['communityId']:>2} size={c['size']:>3} byLabel={c['byLabel']}")

    print("\nSTEP 4 - Shortest path: S1 -> W1")
    r = client.get("/algorithms/shortest-path?source=S1&target=W1&weight=baseCost")
    assert r.status_code == 200, r.text
    body = r.json()
    if body["found"]:
        print(f"    path={body['path']}, totalCost={body['totalWeight']}, hops={body['hops']}")
    else:
        print(f"    not found: {body.get('reason')}")

    print("\nSTEP 5 - Persist centrality on graph")
    r = client.post("/algorithms/persist-centrality?topN=10")
    assert r.status_code == 200, r.text
    print(f"    updated={r.json()['updated']} nodes")

    print("\nPhase 2 smoke test PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
