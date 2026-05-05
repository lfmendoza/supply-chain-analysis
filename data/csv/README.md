# CSV demo dataset

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
