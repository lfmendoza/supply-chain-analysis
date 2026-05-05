"""Export the synthetic dataset as ready-to-use CSV files.

Generates `data/csv/*.csv` from the JSON dataset produced by
`generate_dataset.py`. The CSVs are committed so that the Operations Lab
demo (criterion 4 of the rubric) can upload them through the UI without
having to run a generator first.

Conventions for typed columns expected by the CSV upload endpoint:
  - List<String>  -> values joined with `;` (semicolon).
  - Date          -> ISO `YYYY-MM-DD`.
  - DateTime      -> ISO `YYYY-MM-DDTHH:MM:SSZ`.
  - Boolean       -> `true` / `false`.
  - Point         -> two columns `latitude` and `longitude` (the upload
                     endpoint will compose `point()` from them when given a
                     `pointMapping` hint).
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CSV_DIR = DATA_DIR / "csv"


def _flatten_list(value):
    if isinstance(value, list):
        return ";".join(str(v) for v in value)
    return value


def _bool(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    return value


def _row(rec: dict) -> dict:
    out: dict = {}
    for k, v in rec.items():
        if isinstance(v, list):
            out[k] = _flatten_list(v)
        elif isinstance(v, bool):
            out[k] = _bool(v)
        else:
            out[k] = v
    return out


def _write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(_row(row))
    print(f"  wrote {len(rows):>4} rows -> {path.relative_to(ROOT)}")


# ---------------------------------------------------------------------------
# Column conventions for the upload endpoint:
#   - the first column is the canonical id (so the upload defaults to using
#     it as `idColumn`).
#   - typed columns follow.
# ---------------------------------------------------------------------------

NODE_COLUMNS: dict[str, list[str]] = {
    "Supplier": [
        "id", "name", "country", "locationId", "riskScore", "capacityPerWeek",
        "status", "isCertified", "certifications", "registeredOn", "lastAuditAt",
    ],
    "RawMaterial": ["id", "name", "unit", "criticality"],
    "Product": ["id", "sku", "name", "category", "unitCost"],
    "Warehouse": [
        "id", "name", "region", "locationId", "storageCapacity", "dispatchCapacityPerWeek",
    ],
    "Customer": ["id", "name", "region", "tier", "locationId"],
    "Carrier": ["id", "name", "reliabilityScore"],
    "Location": ["id", "name", "country", "type", "latitude", "longitude"],
    "Route": ["id", "mode", "distanceKm", "status"],
}


REL_COLUMNS: dict[str, tuple[str, list[str]]] = {
    # rel_label_in_data -> (target type for upload UI, columns)
    "SUPPLIES": ("SUPPLIES", ["supplierId", "rawMaterialId", "unitCost", "leadTimeDays", "minOrderQty"]),
    "USED_IN": ("USED_IN", ["rawMaterialId", "productId", "quantityPerUnit"]),
    "CONNECTED_TO": (
        "CONNECTED_TO",
        ["from", "to", "routeId", "distanceKm", "baseCost", "leadTimeDays", "status"],
    ),
    "ALTERNATIVE_TO": ("ALTERNATIVE_TO", ["from", "to", "costDelta", "leadTimeDelta"]),
}


def main() -> int:
    nodes_path = DATA_DIR / "nodes.json"
    rels_path = DATA_DIR / "relationships.json"
    if not nodes_path.exists() or not rels_path.exists():
        print("ERROR: dataset JSONs not found, run scripts.generate_dataset first")
        return 1

    nodes = json.loads(nodes_path.read_text(encoding="utf-8"))
    rels = json.loads(rels_path.read_text(encoding="utf-8"))

    print(f"Exporting CSVs to {CSV_DIR.relative_to(ROOT)}")

    for label, columns in NODE_COLUMNS.items():
        rows = nodes.get(label, [])
        filename = label.lower() + "s.csv" if not label.endswith("s") else label.lower() + ".csv"
        # Tweak a couple of plurals to feel natural.
        filename = {
            "suppliers.csv": "suppliers.csv",
            "rawmaterials.csv": "raw_materials.csv",
            "products.csv": "products.csv",
            "warehouses.csv": "warehouses.csv",
            "customers.csv": "customers.csv",
            "carriers.csv": "carriers.csv",
            "locations.csv": "locations.csv",
            "routes.csv": "routes.csv",
        }.get(filename, filename)
        _write_csv(CSV_DIR / filename, columns, rows)

    for rel_type, (_target, columns) in REL_COLUMNS.items():
        rows = rels.get(rel_type, [])
        _write_csv(CSV_DIR / f"rel_{rel_type.lower()}.csv", columns, rows)

    readme = CSV_DIR / "README.md"
    readme.write_text(
        """# CSV demo dataset

These files are produced by `scripts/export_csv.py` from the synthetic JSON
dataset. They are committed so the **Graph Operations Lab** in the frontend
has ready-to-upload examples.

## Conventions

- The first column of each file is the canonical id (used by the upload
  endpoint as `idColumn`).
- `List<String>` columns (e.g. `certifications`) use semicolons as separators.
- `Date` columns use ISO `YYYY-MM-DD`.
- `DateTime` columns use ISO `YYYY-MM-DDTHH:MM:SSZ`.
- `Boolean` columns use `true` / `false`.
- `Point` properties are stored as two columns (`latitude`, `longitude`); the
  upload endpoint will recombine them via `point({latitude, longitude})` when
  the request includes `pointMapping=true`.

## Files

| File | Purpose |
|------|---------|
| suppliers.csv | Supplier nodes including `isCertified`, `certifications` (list) and audit dates. |
| raw_materials.csv | RawMaterial nodes. |
| products.csv | Product nodes. |
| warehouses.csv | Warehouse nodes. |
| customers.csv | Customer nodes. |
| carriers.csv | Carrier nodes. |
| locations.csv | Location nodes (lat/lon also rebuilt as Point). |
| routes.csv | Route nodes. |
| rel_supplies.csv | SUPPLIES relationships (Supplier -> RawMaterial). |
| rel_used_in.csv | USED_IN relationships (RawMaterial -> Product). |
| rel_connected_to.csv | CONNECTED_TO relationships (Location -> Location, with cost/leadTime). |
| rel_alternative_to.csv | ALTERNATIVE_TO relationships (Supplier -> Supplier). |
""",
        encoding="utf-8",
    )
    print(f"\nDone. CSVs ready at {CSV_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
