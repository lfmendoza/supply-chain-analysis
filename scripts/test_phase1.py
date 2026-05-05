"""Smoke test for Phase 1 backend endpoints (CRUD + Cypher exec + analysis).

Calls the backend through FastAPI's TestClient (no need to spin up uvicorn).
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def _check(label: str, condition: bool, payload=None):
    status = "OK  " if condition else "FAIL"
    print(f"  {status} {label}")
    if not condition and payload is not None:
        print(f"       -> {payload}")


def main() -> int:
    client = TestClient(app)
    print("STEP 1 - /health/neo4j")
    r = client.get("/health/neo4j")
    _check("neo4j reachable", r.status_code == 200, r.text)

    print("\nSTEP 2 - /analysis/connectivity")
    r = client.get("/analysis/connectivity")
    _check("status 200", r.status_code == 200, r.text)
    if r.status_code == 200:
        b = r.json()
        print(f"    nodes={b['totalNodes']} rels={b['totalRelationships']} "
              f"components={b['componentCount']} largestRatio={b['largestComponentRatio']} "
              f"isConnected={b['isConnected']}")

    print("\nSTEP 3 - /analysis/data-types")
    r = client.get("/analysis/data-types")
    _check("status 200", r.status_code == 200, r.text)
    if r.status_code == 200:
        print(f"    typesSeen={r.json()['typesSeen']}")
        print(f"    coverage={r.json()['coverage']}")

    print("\nSTEP 4 - /cypher/execute (read mode)")
    r = client.post(
        "/cypher/execute",
        json={"cypher": "MATCH (n:Supplier) RETURN n.id AS id ORDER BY id LIMIT 3", "mode": "read"},
    )
    _check("status 200", r.status_code == 200, r.text)
    if r.status_code == 200:
        print(f"    rows={r.json()['rowCount']}, sample={r.json()['rows'][:3]}")

    print("\nSTEP 5 - /cypher/execute (read mode rejects writes)")
    r = client.post(
        "/cypher/execute",
        json={"cypher": "CREATE (x:_Probe {ts: timestamp()}) RETURN x", "mode": "read"},
    )
    _check("write rejected in read mode (4xx)", 400 <= r.status_code < 500, r.text)

    print("\nSTEP 6 - CRUD on a temporary multi-label node")
    r = client.post(
        "/graph/nodes",
        json={
            "labels": ["TestNode", "Sandbox"],
            "properties": [
                {"key": "id", "type": "string", "value": "TST-001"},
                {"key": "name", "type": "string", "value": "Probe"},
                {"key": "score", "type": "float", "value": 0.42},
                {"key": "active", "type": "boolean", "value": True},
                {"key": "createdAt", "type": "datetime", "value": "2026-05-05T12:00:00Z"},
                {"key": "tags", "type": "list", "value": ["a", "b"]},
                {"key": "coords", "type": "point", "value": {"latitude": 14.6, "longitude": -90.5}},
            ],
        },
    )
    _check("create multi-label node with all property types", r.status_code == 200, r.text)
    eid = r.json()["elementId"] if r.status_code == 200 else None
    if r.status_code == 200:
        print(f"    elementId={eid}, labels={r.json()['labels']}")

    r = client.patch(
        "/graph/nodes/TST-001",
        json={"set": [{"key": "score", "type": "float", "value": 0.99}]},
    )
    _check("update node property", r.status_code == 200, r.text)

    r = client.delete("/graph/nodes/TST-001/properties/active")
    _check("delete node property", r.status_code == 200, r.text)

    print("\nSTEP 7 - Relationship CRUD between two suppliers")
    # Create a temporary relationship between S1 and S2 of an arbitrary type, then rewire & delete.
    r = client.post(
        "/graph/relationships",
        json={
            "startId": "S1",
            "endId": "S2",
            "type": "TEST_REL",
            "properties": [
                {"key": "weight", "type": "float", "value": 1.5},
                {"key": "valid", "type": "boolean", "value": True},
            ],
        },
    )
    _check("create relationship", r.status_code == 200, r.text)
    rel_eid = r.json()["elementId"] if r.status_code == 200 else None
    if rel_eid:
        r = client.patch(
            f"/graph/relationships/{rel_eid}",
            json={"set": [{"key": "weight", "type": "float", "value": 2.0}], "remove": ["valid"]},
        )
        _check("update + remove rel property", r.status_code == 200, r.text)
        r = client.post(
            f"/graph/relationships/{rel_eid}/rewire",
            json={"newType": "TEST_REL_RENAMED", "flipDirection": True},
        )
        _check("rewire relationship (new type + flipped)", r.status_code == 200, r.text)
        new_eid = r.json()["elementId"] if r.status_code == 200 else None
        if new_eid:
            r = client.delete(f"/graph/relationships/{new_eid}")
            _check("delete relationship", r.status_code == 200, r.text)

    print("\nSTEP 8 - Clean up the test node")
    r = client.delete("/graph/nodes/TST-001?detach=true")
    _check("delete node", r.status_code == 200, r.text)

    print("\nPhase 1 smoke test finished.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
