"""Smoke test for the Phase 4 CSV upload endpoints.

Sequence:
  1) GET  /csv/templates                     -> sanity check
  2) POST /csv/upload/nodes (suppliers.csv)  -> idempotent merge upsert
  3) POST /csv/upload/relationships          -> a tiny synthetic CSV in memory
  4) Cleanup the synthetic relationships and the throwaway supplier we used
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
DATA = ROOT / "data"

if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def _print_step(num: int, title: str) -> None:
    print(f"\nSTEP {num} - {title}")


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  FAIL {msg}")
        raise SystemExit(2)
    print(f"  OK   {msg}")


def main() -> int:
    client = TestClient(app)

    # 1. templates ---------------------------------------------------------
    _print_step(1, "GET /csv/templates")
    r = client.get("/csv/templates")
    _assert(r.status_code == 200, f"status {r.status_code}")
    body = r.json()
    _assert(any(t["label"] == "Supplier" for t in body["nodes"]), "Supplier template present")
    _assert(any(t["relationshipType"] == "SUPPLIES" for t in body["relationships"]), "SUPPLIES template present")
    print(f"    supportedTypes={body['supportedTypes']}")

    # 2. upload nodes (suppliers.csv) -------------------------------------
    _print_step(2, "POST /csv/upload/nodes (suppliers.csv)")
    suppliers_csv = (DATA / "csv" / "suppliers.csv").read_bytes()
    r = client.post(
        "/csv/upload/nodes",
        data={
            "label": "Supplier",
            "idColumn": "id",
            "columnTypes": (
                '{"riskScore":"float","capacityPerWeek":"integer",'
                '"isCertified":"boolean","certifications":"list",'
                '"registeredOn":"date","lastAuditAt":"datetime"}'
            ),
            "mode": "merge",
        },
        files={"file": ("suppliers.csv", suppliers_csv, "text/csv")},
    )
    _assert(r.status_code == 200, f"status {r.status_code}: {r.text[:200]}")
    payload = r.json()
    _assert(payload["processed"] == 8, f"processed={payload['processed']}")
    _assert(payload["written"] == 8, f"written={payload['written']}")
    print(f"    elapsedMs={payload['elapsedMs']} errors={len(payload['errors'])}")

    # 2b. one-row CSV with all 8 datatypes for a brand-new node -----------
    _print_step(3, "POST /csv/upload/nodes (single row, all 8 types)")
    csv_text = (
        "id,name,country,locationId,riskScore,capacityPerWeek,status,"
        "isCertified,certifications,registeredOn,lastAuditAt\n"
        'TEST-S99,Test Supplier,US,LOC1,0.10,1234,active,true,'
        '"ISO9001;ECOVADIS",2026-01-15,2026-04-01T08:30:00Z\n'
    )
    r = client.post(
        "/csv/upload/nodes",
        data={
            "label": "Supplier",
            "idColumn": "id",
            "columnTypes": (
                '{"riskScore":"float","capacityPerWeek":"integer",'
                '"isCertified":"boolean","certifications":"list",'
                '"registeredOn":"date","lastAuditAt":"datetime"}'
            ),
            "mode": "merge",
        },
        files={"file": ("test_supplier.csv", csv_text.encode("utf-8"), "text/csv")},
    )
    _assert(r.status_code == 200 and r.json()["written"] == 1, f"single-row upload {r.json()}")

    # Verify the record came in with native types.
    r = client.post(
        "/cypher/execute",
        json={
            "cypher": (
                'MATCH (s:Supplier {id: "TEST-S99"}) '
                "RETURN s.isCertified AS isCertified, s.certifications AS certs, "
                "s.registeredOn AS d, s.lastAuditAt AS dt"
            ),
            "mode": "read",
        },
    )
    row = r.json()["rows"][0]
    print(f"    re-read row -> {row}")
    _assert(row["isCertified"] is True, "isCertified is Boolean true")
    _assert(row["certs"] == ["ISO9001", "ECOVADIS"], "certifications kept as list")
    _assert(str(row["d"]).startswith("2026-01-15"), "registeredOn is a Date")

    # 3. upload a relationship CSV ----------------------------------------
    _print_step(4, "POST /csv/upload/relationships (TEST-S99 -> RM-A)")
    rel_csv = "supplierId,rawMaterialId,unitCost,leadTimeDays,minOrderQty\nTEST-S99,RM-A,9.99,5,100\n"
    r = client.post(
        "/csv/upload/relationships",
        data={
            "type": "SUPPLIES",
            "fromColumn": "supplierId",
            "toColumn": "rawMaterialId",
            "fromLabel": "Supplier",
            "toLabel": "RawMaterial",
            "columnTypes": '{"unitCost":"float","leadTimeDays":"integer","minOrderQty":"integer"}',
        },
        files={"file": ("rel.csv", rel_csv.encode("utf-8"), "text/csv")},
    )
    _assert(r.status_code == 200, f"status {r.status_code}: {r.text[:200]}")
    body = r.json()
    _assert(body["written"] == 1, f"written={body['written']}")

    # 4. cleanup ----------------------------------------------------------
    _print_step(5, "Cleanup synthetic node TEST-S99")
    r = client.post(
        "/cypher/execute",
        json={
            "cypher": 'MATCH (s:Supplier {id: "TEST-S99"}) DETACH DELETE s',
            "mode": "write",
        },
    )
    _assert(r.status_code == 200, f"cleanup status {r.status_code}: {r.text[:200]}")

    print("\nPhase 4 smoke test PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
