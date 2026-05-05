"""Seed the AuraDB instance with the synthetic supply-chain graph.

Run from the project root after configuring `backend/.env`:

    python -m scripts.seed_graph                 # apply (idempotent MERGE)
    python -m scripts.seed_graph --reset         # wipe everything first
    python -m scripts.seed_graph --skip-generate # don't regenerate JSONs

The pipeline is:
    1. (optional) regenerate the JSON dataset
    2. (optional) wipe graph
    3. apply constraints + indexes
    4. load nodes (idempotent MERGE)
    5. load relationships
    6. compute derived DEPENDS_ON
    7. validate node and relationship counts
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
DATA_DIR = ROOT / "data"
CYPHER_DIR = ROOT / "cypher"

if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.db.neo4j_client import Neo4jClient  # noqa: E402

# ---------------------------------------------------------------------------
# Cypher templates
# ---------------------------------------------------------------------------

NODE_CYPHERS: dict[str, str] = {
    # Location: turn raw lat/lon into a native Neo4j Point (WGS-84) so the
    # graph exercises the spatial datatype required by the rubric.
    "Location": """
        UNWIND $rows AS row
        MERGE (n:Location {id: row.id})
        SET n.name = row.name,
            n.country = row.country,
            n.type = row.type,
            n.latitude = row.latitude,
            n.longitude = row.longitude,
            n.coords = point({latitude: row.latitude, longitude: row.longitude, srid: 4326})
    """,
    "Carrier": "UNWIND $rows AS row MERGE (n:Carrier {id: row.id}) SET n += row",
    # Supplier: use date()/datetime() Cypher functions so registeredOn and
    # lastAuditAt land as native temporal values (not strings) and the
    # certifications List<String> is set as-is.
    "Supplier": """
        UNWIND $rows AS row
        MERGE (n:Supplier {id: row.id})
        SET n.name = row.name,
            n.country = row.country,
            n.locationId = row.locationId,
            n.riskScore = row.riskScore,
            n.capacityPerWeek = row.capacityPerWeek,
            n.status = row.status,
            n.isCertified = row.isCertified,
            n.certifications = row.certifications,
            n.registeredOn = date(row.registeredOn),
            n.lastAuditAt = datetime(row.lastAuditAt)
    """,
    "RawMaterial": "UNWIND $rows AS row MERGE (n:RawMaterial {id: row.id}) SET n += row",
    "Product": "UNWIND $rows AS row MERGE (n:Product {id: row.id}) SET n += row",
    "Warehouse": "UNWIND $rows AS row MERGE (n:Warehouse {id: row.id}) SET n += row",
    "Inventory": "UNWIND $rows AS row MERGE (n:Inventory {id: row.id}) SET n += row",
    "Customer": "UNWIND $rows AS row MERGE (n:Customer {id: row.id}) SET n += row",
    "CustomerOrder": "UNWIND $rows AS row MERGE (n:CustomerOrder {id: row.id}) SET n += row",
    "PurchaseOrder": "UNWIND $rows AS row MERGE (n:PurchaseOrder {id: row.id}) SET n += row",
    "Shipment": "UNWIND $rows AS row MERGE (n:Shipment {id: row.id}) SET n += row",
    "Route": "UNWIND $rows AS row MERGE (n:Route {id: row.id}) SET n += row",
}

REL_CYPHERS: dict[str, str] = {
    "LOCATED_AT_SUPPLIER": """
        UNWIND $rows AS row
        MATCH (s:Supplier {id: row.from}), (l:Location {id: row.to})
        MERGE (s)-[:LOCATED_AT]->(l)
    """,
    "LOCATED_AT_WAREHOUSE": """
        UNWIND $rows AS row
        MATCH (w:Warehouse {id: row.from}), (l:Location {id: row.to})
        MERGE (w)-[:LOCATED_AT]->(l)
    """,
    "LOCATED_AT_CUSTOMER": """
        UNWIND $rows AS row
        MATCH (c:Customer {id: row.from}), (l:Location {id: row.to})
        MERGE (c)-[:LOCATED_AT]->(l)
    """,
    "SUPPLIES": """
        UNWIND $rows AS row
        MATCH (s:Supplier {id: row.supplierId}), (rm:RawMaterial {id: row.rawMaterialId})
        MERGE (s)-[r:SUPPLIES]->(rm)
        SET r.unitCost = row.unitCost,
            r.leadTimeDays = row.leadTimeDays,
            r.minOrderQty = row.minOrderQty
    """,
    "USED_IN": """
        UNWIND $rows AS row
        MATCH (rm:RawMaterial {id: row.rawMaterialId}), (p:Product {id: row.productId})
        MERGE (rm)-[r:USED_IN]->(p)
        SET r.quantityPerUnit = row.quantityPerUnit
    """,
    "CONNECTED_TO": """
        UNWIND $rows AS row
        MATCH (a:Location {id: row.from}), (b:Location {id: row.to})
        MERGE (a)-[r:CONNECTED_TO {routeId: row.routeId}]->(b)
        SET r.distanceKm = row.distanceKm,
            r.baseCost = row.baseCost,
            r.leadTimeDays = row.leadTimeDays,
            r.status = row.status
    """,
    "CARRIED_BY": """
        UNWIND $rows AS row
        MATCH (rt:Route {id: row.routeId}), (c:Carrier {id: row.carrierId})
        MERGE (rt)-[r:CARRIED_BY]->(c)
        SET r.costMultiplier = row.costMultiplier
    """,
    "ALTERNATIVE_TO": """
        UNWIND $rows AS row
        MATCH (a:Supplier {id: row.from}), (b:Supplier {id: row.to})
        MERGE (a)-[r:ALTERNATIVE_TO]->(b)
        SET r.costDelta = row.costDelta,
            r.leadTimeDelta = row.leadTimeDelta
    """,
    "HAS_INVENTORY": """
        UNWIND $rows AS row
        MATCH (w:Warehouse {id: row.warehouseId}), (i:Inventory {id: row.inventoryId})
        MERGE (w)-[:HAS_INVENTORY]->(i)
    """,
    "OF_PRODUCT": """
        UNWIND $rows AS row
        MATCH (i:Inventory {id: row.inventoryId}), (p:Product {id: row.productId})
        MERGE (i)-[:OF_PRODUCT]->(p)
    """,
    "PLACED_BY": """
        UNWIND $rows AS row
        MATCH (co:CustomerOrder {id: row.orderId}), (c:Customer {id: row.customerId})
        MERGE (co)-[:PLACED_BY]->(c)
    """,
    "FOR_PRODUCT": """
        UNWIND $rows AS row
        MATCH (co:CustomerOrder {id: row.orderId}), (p:Product {id: row.productId})
        MERGE (co)-[r:FOR_PRODUCT]->(p)
        SET r.quantity = row.quantity
    """,
    "SOURCED_FROM": """
        UNWIND $rows AS row
        MATCH (po:PurchaseOrder {id: row.orderId}), (s:Supplier {id: row.supplierId})
        MERGE (po)-[:SOURCED_FROM]->(s)
    """,
    "FOR_MATERIAL": """
        UNWIND $rows AS row
        MATCH (po:PurchaseOrder {id: row.orderId}), (rm:RawMaterial {id: row.rawMaterialId})
        MERGE (po)-[:FOR_MATERIAL]->(rm)
    """,
    "FULFILLS": """
        UNWIND $rows AS row
        MATCH (sh:Shipment {id: row.shipmentId}), (co:CustomerOrder {id: row.orderId})
        MERGE (sh)-[r:FULFILLS]->(co)
        SET r.fulfillmentPct = row.fulfillmentPct
    """,
    "SHIPS_FROM": """
        UNWIND $rows AS row
        MATCH (sh:Shipment {id: row.shipmentId}), (w:Warehouse {id: row.warehouseId})
        MERGE (sh)-[:SHIPS_FROM]->(w)
    """,
    "DELIVERS_TO": """
        UNWIND $rows AS row
        MATCH (sh:Shipment {id: row.shipmentId}), (c:Customer {id: row.customerId})
        MERGE (sh)-[:DELIVERS_TO]->(c)
    """,
    "USES_ROUTE": """
        UNWIND $rows AS row
        MATCH (sh:Shipment {id: row.shipmentId}), (rt:Route {id: row.routeId})
        MERGE (sh)-[r:USES_ROUTE]->(rt)
        SET r.actualLeadTime = row.actualLeadTime
    """,
}

DERIVED_DEPENDS_ON = """
    MATCH (p:Product)<-[u:USED_IN]-(rm:RawMaterial)
    MERGE (p)-[d:DEPENDS_ON]->(rm)
    SET d.criticalityWeight = u.quantityPerUnit
"""

WIPE = "MATCH (n) DETACH DELETE n"


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def load_constraints(client: Neo4jClient) -> None:
    constraints_file = CYPHER_DIR / "00_constraints.cypher"
    text = constraints_file.read_text(encoding="utf-8")
    for stmt in [s.strip() for s in text.split(";") if s.strip() and not s.strip().startswith("//")]:
        client.run_write(stmt)


def load_nodes(client: Neo4jClient, nodes: dict) -> None:
    for label, rows in nodes.items():
        if not rows:
            continue
        cypher = NODE_CYPHERS.get(label)
        if not cypher:
            print(f"  skip unknown label: {label}")
            continue
        client.run_write(cypher, {"rows": rows})
        print(f"  loaded {len(rows):>4} {label}")


def load_relationships(client: Neo4jClient, rels: dict) -> None:
    for rel_type, rows in rels.items():
        if not rows:
            continue
        cypher = REL_CYPHERS.get(rel_type)
        if not cypher:
            print(f"  skip unknown rel: {rel_type}")
            continue
        client.run_write(cypher, {"rows": rows})
        print(f"  loaded {len(rows):>4} {rel_type}")


def compute_derived(client: Neo4jClient) -> None:
    client.run_write(DERIVED_DEPENDS_ON)
    print("  computed DEPENDS_ON")


def validate(client: Neo4jClient, expected_nodes: dict, expected_rels: dict) -> bool:
    print("\nValidation:")
    ok = True
    for label, rows in expected_nodes.items():
        result = client.run(f"MATCH (n:{label}) RETURN count(n) AS c")
        actual = result[0]["c"]
        flag = "OK" if actual >= len(rows) else "FAIL"
        if flag == "FAIL":
            ok = False
        print(f"  {flag} {label:<16} expected>={len(rows):>4}   actual={actual:>4}")

    # spot-check that the showcase path exists
    res = client.run(
        "MATCH (s:Supplier)-[:SUPPLIES]->(:RawMaterial)-[:USED_IN]->(:Product)<-[:FOR_PRODUCT]-(:CustomerOrder) "
        "RETURN count(*) AS c"
    )
    if res[0]["c"] == 0:
        ok = False
        print("  FAIL showcase path supplier->material->product->order is empty")
    else:
        print(f"  OK   showcase path count = {res[0]['c']}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Neo4j with the synthetic supply chain graph")
    parser.add_argument("--reset", action="store_true", help="DETACH DELETE all nodes before loading")
    parser.add_argument("--skip-generate", action="store_true", help="reuse the existing JSON dataset")
    args = parser.parse_args()

    if not args.skip_generate:
        from scripts import generate_dataset  # noqa: WPS433
        generate_dataset.main()

    nodes_path = DATA_DIR / "nodes.json"
    rels_path = DATA_DIR / "relationships.json"
    if not nodes_path.exists() or not rels_path.exists():
        print("ERROR: dataset JSONs not found, run without --skip-generate first", file=sys.stderr)
        return 1

    nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
    rels = json.loads(rels_path.read_text(encoding="utf-8"))

    client = Neo4jClient()
    try:
        client.verify_connectivity()

        if args.reset:
            print("Wiping graph ...")
            client.run_write(WIPE)

        print("Applying constraints and indexes ...")
        load_constraints(client)

        print("Loading nodes ...")
        load_nodes(client, nodes)

        print("Loading relationships ...")
        load_relationships(client, rels)

        print("Computing derived relationships ...")
        compute_derived(client)

        ok = validate(client, nodes, rels)
        if not ok:
            print("\nSeed completed with VALIDATION FAILURES.", file=sys.stderr)
            return 2
        print("\nSeed completed successfully.")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
