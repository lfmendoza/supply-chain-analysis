"""Smoke test for the bulk node/relationship endpoints.

Creates a few `:DemoBulk` and `:DemoRel` nodes, exercises bulk-update and
bulk-delete on both nodes and relationships, and verifies the resulting state
through `/cypher/execute`.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient

from app.main import app


def _cypher(c: TestClient, q: str) -> list[dict]:
    r = c.post("/cypher/execute", json={"cypher": q, "mode": "read"})
    assert r.status_code == 200, r.text
    return r.json()["rows"]


def main() -> int:
    c = TestClient(app)

    print("STEP 1 - Create 3 :DemoBulk nodes")
    for i in range(3):
        r = c.post(
            "/graph/nodes",
            json={
                "labels": ["DemoBulk"],
                "properties": [
                    {"key": "id", "type": "string", "value": f"DB-{i+1}"},
                    {"key": "name", "type": "string", "value": f"demo bulk {i+1}"},
                ],
            },
        )
        assert r.status_code == 200, r.text

    print("STEP 2 - Bulk-update add `demoTier='premium'` on every :DemoBulk")
    r = c.post(
        "/graph/nodes/bulk-update",
        json={
            "filter": {"label": "DemoBulk"},
            "set": [{"key": "demoTier", "type": "string", "value": "premium"}],
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    print(f"   matched={body['matched']} updated={body['updated']}")
    assert body["matched"] == 3, body

    rows = _cypher(c, "MATCH (n:DemoBulk) RETURN n.id AS id, n.demoTier AS demoTier ORDER BY n.id")
    assert all(r["demoTier"] == "premium" for r in rows), rows

    print("STEP 3 - Bulk-update remove `demoTier`")
    r = c.post(
        "/graph/nodes/bulk-update",
        json={"filter": {"label": "DemoBulk"}, "remove": ["demoTier"]},
    )
    assert r.status_code == 200, r.text
    rows = _cypher(c, "MATCH (n:DemoBulk) RETURN n.demoTier AS demoTier")
    assert all(r["demoTier"] is None for r in rows), rows

    print("STEP 4 - bulk-delete without `confirm` rejects (400)")
    r = c.post("/graph/nodes/bulk-delete", json={"filter": {"label": "DemoBulk"}})
    assert r.status_code == 400, r.text

    print("STEP 5 - bulk-delete with `confirm:true`")
    r = c.post(
        "/graph/nodes/bulk-delete",
        json={"filter": {"label": "DemoBulk"}, "confirm": True},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    print(f"   deleted={body['deleted']}")
    rows = _cypher(c, "MATCH (n:DemoBulk) RETURN count(n) AS remaining")
    assert rows[0]["remaining"] == 0, rows

    print("STEP 6 - Bulk relationships flow")
    # Create 2 :DemoRel nodes connected by 2 :DEMO_LINK rels
    for i in range(2):
        c.post(
            "/graph/nodes",
            json={
                "labels": ["DemoRel"],
                "properties": [{"key": "id", "type": "string", "value": f"DR-{i+1}"}],
            },
        )
    for i in range(2):
        r = c.post(
            "/graph/relationships",
            json={
                "startId": "DR-1",
                "endId": "DR-2",
                "type": "DEMO_LINK",
                "properties": [{"key": "weight", "type": "float", "value": float(i + 1)}],
            },
        )
        assert r.status_code == 200, r.text

    print("STEP 7 - Bulk-update DEMO_LINK riskFlag=true")
    r = c.post(
        "/graph/relationships/bulk-update",
        json={
            "filter": {"type": "DEMO_LINK"},
            "set": [{"key": "riskFlag", "type": "boolean", "value": True}],
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    print(f"   matched={body['matched']} set={body['set']}")
    assert body["matched"] == 2

    print("STEP 8 - Bulk-delete DEMO_LINK")
    r = c.post(
        "/graph/relationships/bulk-delete",
        json={"filter": {"type": "DEMO_LINK"}, "confirm": True},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    print(f"   deleted={body['deleted']}")
    rows = _cypher(c, "MATCH ()-[r:DEMO_LINK]->() RETURN count(r) AS remaining")
    assert rows[0]["remaining"] == 0, rows

    print("STEP 9 - Cleanup DemoRel nodes")
    c.post(
        "/graph/nodes/bulk-delete",
        json={"filter": {"label": "DemoRel"}, "confirm": True},
    )

    print("\nBulk endpoints smoke test PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
