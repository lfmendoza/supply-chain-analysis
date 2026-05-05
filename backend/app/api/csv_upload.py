"""CSV bulk upload: `POST /csv/upload/nodes`, `POST /csv/upload/relationships`, `GET /csv/templates`.

Multipart form: `file` plus JSON-ish form fields (`columnTypes`, `pointColumns`, …).
Templates describe the files under `data/csv/`.
"""

from __future__ import annotations

import csv
import json
import logging
import re
from io import StringIO
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.api.operations import (
    PropertyType,
    TypedProperty,
    _convert_value,
    _validate_identifier,
)
from app.db.neo4j_client import Neo4jClientError, get_neo4j_client, to_jsonable

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/csv", tags=["csv-upload"])


_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class CsvUploadResult(BaseModel):
    processed: int
    written: int
    errors: list[dict[str, Any]]
    elapsedMs: float
    sampleRow: dict[str, Any] | None = None


class CsvTemplate(BaseModel):
    """Self-describing metadata for one bundled CSV."""

    name: str
    kind: Literal["nodes", "relationships"]
    label: str | None = None
    relationshipType: str | None = None
    fromLabel: str | None = None
    toLabel: str | None = None
    idColumn: str | None = None
    fromColumn: str | None = None
    toColumn: str | None = None
    columns: list[dict[str, str]]
    pointColumns: list[dict[str, str]] = []
    additionalLabels: list[str] = []
    listSeparator: str = ";"
    description: str | None = None


def _parse_json_field(value: str, default: Any) -> Any:
    if value is None or value == "":
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON: {exc}") from exc


def _coerce_cell(value: str, type_name: str, list_separator: str) -> Any:
    """Coerce a CSV cell string into the requested Neo4j-friendly value."""
    if value is None:
        return None
    stripped = value.strip()
    if stripped == "":
        return None
    if type_name == "list":
        return [v.strip() for v in stripped.split(list_separator) if v.strip()]
    prop = TypedProperty(key="_csv", type=type_name, value=stripped)
    return _convert_value(prop)


def _convert_row(
    raw: dict[str, str],
    column_types: dict[str, str],
    point_columns: list[dict[str, str]],
    list_separator: str,
    skip_columns: set[str],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Turn a CSV row into a dict of Neo4j-driver values, plus error list."""
    errors: list[dict[str, Any]] = []
    out: dict[str, Any] = {}

    for spec in point_columns:
        key = spec.get("key")
        lat_col = spec.get("latitudeColumn")
        lng_col = spec.get("longitudeColumn")
        if not key or not lat_col or not lng_col:
            errors.append(
                {"column": "<point>", "error": "pointColumns entry needs key/latitudeColumn/longitudeColumn"}
            )
            continue
        lat = raw.get(lat_col)
        lng = raw.get(lng_col)
        if lat in (None, "") or lng in (None, ""):
            continue
        try:
            out[key] = _coerce_cell(
                json.dumps({"latitude": float(lat), "longitude": float(lng)}),
                "point",
                list_separator,
            )
        except Exception as exc:  # noqa: BLE001
            errors.append({"column": key, "error": f"point conversion failed: {exc}"})

    for col, val in raw.items():
        if col in skip_columns:
            continue
        if col is None:
            continue
        if not _IDENT.match(col):
            errors.append({"column": col, "error": "column is not a valid Cypher identifier; skipped"})
            continue
        type_name = column_types.get(col, "string")
        try:
            converted = _coerce_cell(val, type_name, list_separator)
        except Exception as exc:  # noqa: BLE001
            errors.append({"column": col, "error": f"({type_name}) {exc}"})
            continue
        if converted is not None:
            out[col] = converted

    return out, errors


def _read_csv(file: UploadFile, content: bytes) -> list[dict[str, str]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail=f"CSV file {file.filename!r} has no header row")
    return [dict(row) for row in reader]


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


@router.post("/upload/nodes", response_model=CsvUploadResult)
async def upload_nodes(
    file: UploadFile = File(..., description="CSV file with a header row."),
    label: str = Form(..., description="Primary node label, e.g. Supplier."),
    idColumn: str = Form("id", description="Column whose value identifies the node."),
    columnTypes: str = Form(
        "{}",
        description='JSON map {column: type} where type is one of '
        '"string|integer|float|boolean|date|datetime|list|point".',
    ),
    pointColumns: str = Form(
        "[]",
        description='JSON list [{key, latitudeColumn, longitudeColumn}] to compose Point properties.',
    ),
    additionalLabels: str = Form("", description="Comma-separated extra labels."),
    listSeparator: str = Form(";", description="Separator used inside list columns."),
    mode: Literal["merge", "create"] = Form("merge"),
) -> CsvUploadResult:
    """Bulk-load nodes from a CSV, supporting all Neo4j datatypes."""
    import time

    primary = _validate_identifier(label, "label")
    extras = [
        _validate_identifier(piece.strip(), "label")
        for piece in additionalLabels.split(",")
        if piece.strip()
    ]
    if not _IDENT.match(idColumn):
        raise HTTPException(status_code=422, detail=f"idColumn '{idColumn}' is not a valid identifier")

    column_types: dict[str, str] = _parse_json_field(columnTypes, {}) or {}
    point_columns: list[dict[str, str]] = _parse_json_field(pointColumns, []) or []

    raw_bytes = await file.read()
    csv_rows = _read_csv(file, raw_bytes)
    if not csv_rows:
        return CsvUploadResult(processed=0, written=0, errors=[], elapsedMs=0.0)

    skip_columns: set[str] = set()
    for spec in point_columns:
        for key in ("latitudeColumn", "longitudeColumn"):
            if spec.get(key):
                skip_columns.add(spec[key])

    converted_rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for index, raw in enumerate(csv_rows, start=1):
        row, row_errors = _convert_row(
            raw, column_types, point_columns, listSeparator, skip_columns
        )
        if idColumn not in row:
            errors.append({"row": index, "error": f"missing id column '{idColumn}'"})
            continue
        for err in row_errors:
            errors.append({"row": index, **err})
        converted_rows.append(row)

    if not converted_rows:
        return CsvUploadResult(processed=len(csv_rows), written=0, errors=errors, elapsedMs=0.0)

    label_clause = ":".join(f"`{lbl}`" for lbl in [primary, *extras])

    if mode == "merge":
        cypher = (
            f"UNWIND $rows AS row "
            f"MERGE (n:{label_clause} {{ `{idColumn}`: row.`{idColumn}` }}) "
            f"SET n += row "
            f"RETURN count(n) AS written"
        )
    else:
        cypher = (
            f"UNWIND $rows AS row "
            f"CREATE (n:{label_clause}) SET n = row "
            f"RETURN count(n) AS written"
        )

    started = time.perf_counter()
    try:
        rows = get_neo4j_client().run_jsonable(cypher, {"rows": converted_rows}, write=True)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    written = int(rows[0]["written"]) if rows else 0
    return CsvUploadResult(
        processed=len(csv_rows),
        written=written,
        errors=errors,
        elapsedMs=round(elapsed_ms, 2),
        sampleRow=to_jsonable(converted_rows[0]) if converted_rows else None,
    )


# ---------------------------------------------------------------------------
# Relationships
# ---------------------------------------------------------------------------


@router.post("/upload/relationships", response_model=CsvUploadResult)
async def upload_relationships(
    file: UploadFile = File(...),
    type: str = Form(..., description="Relationship type, e.g. SUPPLIES."),
    fromColumn: str = Form(..., description="CSV column with the start-node id."),
    toColumn: str = Form(..., description="CSV column with the end-node id."),
    fromLabel: str | None = Form(None),
    toLabel: str | None = Form(None),
    columnTypes: str = Form("{}"),
    listSeparator: str = Form(";"),
    mode: Literal["merge", "create"] = Form("merge"),
) -> CsvUploadResult:
    """Bulk-load relationships between existing nodes, matched by id columns."""
    import time

    rel_type = _validate_identifier(type, "relationship type")
    if fromLabel is not None:
        _validate_identifier(fromLabel, "label")
    if toLabel is not None:
        _validate_identifier(toLabel, "label")
    if not _IDENT.match(fromColumn) or not _IDENT.match(toColumn):
        raise HTTPException(
            status_code=422,
            detail="fromColumn and toColumn must be valid Cypher identifiers",
        )

    column_types: dict[str, str] = _parse_json_field(columnTypes, {}) or {}

    raw_bytes = await file.read()
    csv_rows = _read_csv(file, raw_bytes)
    if not csv_rows:
        return CsvUploadResult(processed=0, written=0, errors=[], elapsedMs=0.0)

    converted: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    skip_columns = {fromColumn, toColumn}
    for index, raw in enumerate(csv_rows, start=1):
        if not raw.get(fromColumn) or not raw.get(toColumn):
            errors.append({"row": index, "error": f"missing {fromColumn} or {toColumn}"})
            continue
        props, row_errors = _convert_row(
            raw, column_types, [], listSeparator, skip_columns
        )
        for err in row_errors:
            errors.append({"row": index, **err})
        converted.append(
            {
                "_from": raw[fromColumn].strip(),
                "_to": raw[toColumn].strip(),
                "_props": props,
            }
        )

    if not converted:
        return CsvUploadResult(processed=len(csv_rows), written=0, errors=errors, elapsedMs=0.0)

    if fromLabel:
        from_match = f"MATCH (s:`{fromLabel}` {{id: row._from}})"
    else:
        from_match = "MATCH (s {id: row._from})"
    if toLabel:
        to_match = f"MATCH (t:`{toLabel}` {{id: row._to}})"
    else:
        to_match = "MATCH (t {id: row._to})"

    verb = "MERGE" if mode == "merge" else "CREATE"
    cypher = (
        f"UNWIND $rows AS row "
        f"{from_match} {to_match} "
        f"{verb} (s)-[r:`{rel_type}`]->(t) "
        f"SET r += row._props "
        f"RETURN count(r) AS written"
    )

    started = time.perf_counter()
    try:
        rows = get_neo4j_client().run_jsonable(cypher, {"rows": converted}, write=True)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    written = int(rows[0]["written"]) if rows else 0
    sample = converted[0] if converted else None
    return CsvUploadResult(
        processed=len(csv_rows),
        written=written,
        errors=errors,
        elapsedMs=round(elapsed_ms, 2),
        sampleRow=to_jsonable(sample) if sample else None,
    )


# ---------------------------------------------------------------------------
# Templates manifest (so the UI can pre-fill the form)
# ---------------------------------------------------------------------------


_TEMPLATES_DIR = Path(__file__).resolve().parents[3] / "data" / "csv"


_NODE_TEMPLATES: list[CsvTemplate] = [
    CsvTemplate(
        name="suppliers.csv",
        kind="nodes",
        label="Supplier",
        idColumn="id",
        description="Supplier nodes (Boolean, list, Date, DateTime among others).",
        columns=[
            {"name": "id", "type": "string"},
            {"name": "name", "type": "string"},
            {"name": "country", "type": "string"},
            {"name": "locationId", "type": "string"},
            {"name": "riskScore", "type": "float"},
            {"name": "capacityPerWeek", "type": "integer"},
            {"name": "status", "type": "string"},
            {"name": "isCertified", "type": "boolean"},
            {"name": "certifications", "type": "list"},
            {"name": "registeredOn", "type": "date"},
            {"name": "lastAuditAt", "type": "datetime"},
        ],
    ),
    CsvTemplate(
        name="locations.csv",
        kind="nodes",
        label="Location",
        idColumn="id",
        description="Location nodes; latitude+longitude are recombined into a Point property.",
        columns=[
            {"name": "id", "type": "string"},
            {"name": "name", "type": "string"},
            {"name": "country", "type": "string"},
            {"name": "type", "type": "string"},
            {"name": "latitude", "type": "float"},
            {"name": "longitude", "type": "float"},
        ],
        pointColumns=[
            {"key": "coords", "latitudeColumn": "latitude", "longitudeColumn": "longitude"}
        ],
    ),
    CsvTemplate(
        name="warehouses.csv",
        kind="nodes",
        label="Warehouse",
        idColumn="id",
        description="Warehouse nodes.",
        columns=[
            {"name": "id", "type": "string"},
            {"name": "name", "type": "string"},
            {"name": "region", "type": "string"},
            {"name": "locationId", "type": "string"},
            {"name": "storageCapacity", "type": "integer"},
            {"name": "dispatchCapacityPerWeek", "type": "integer"},
        ],
    ),
    CsvTemplate(
        name="products.csv",
        kind="nodes",
        label="Product",
        idColumn="id",
        description="Product nodes.",
        columns=[
            {"name": "id", "type": "string"},
            {"name": "sku", "type": "string"},
            {"name": "name", "type": "string"},
            {"name": "category", "type": "string"},
            {"name": "unitCost", "type": "float"},
        ],
    ),
]


_REL_TEMPLATES: list[CsvTemplate] = [
    CsvTemplate(
        name="rel_supplies.csv",
        kind="relationships",
        relationshipType="SUPPLIES",
        fromLabel="Supplier",
        toLabel="RawMaterial",
        fromColumn="supplierId",
        toColumn="rawMaterialId",
        description="SUPPLIES edges with cost and lead time properties.",
        columns=[
            {"name": "supplierId", "type": "string"},
            {"name": "rawMaterialId", "type": "string"},
            {"name": "unitCost", "type": "float"},
            {"name": "leadTimeDays", "type": "integer"},
            {"name": "minOrderQty", "type": "integer"},
        ],
    ),
    CsvTemplate(
        name="rel_used_in.csv",
        kind="relationships",
        relationshipType="USED_IN",
        fromLabel="RawMaterial",
        toLabel="Product",
        fromColumn="rawMaterialId",
        toColumn="productId",
        description="Bill-of-materials edges.",
        columns=[
            {"name": "rawMaterialId", "type": "string"},
            {"name": "productId", "type": "string"},
            {"name": "quantityPerUnit", "type": "float"},
        ],
    ),
    CsvTemplate(
        name="rel_connected_to.csv",
        kind="relationships",
        relationshipType="CONNECTED_TO",
        fromLabel="Location",
        toLabel="Location",
        fromColumn="from",
        toColumn="to",
        description="Transport network edges between Locations.",
        columns=[
            {"name": "from", "type": "string"},
            {"name": "to", "type": "string"},
            {"name": "routeId", "type": "string"},
            {"name": "distanceKm", "type": "float"},
            {"name": "baseCost", "type": "float"},
            {"name": "leadTimeDays", "type": "integer"},
            {"name": "status", "type": "string"},
        ],
    ),
    CsvTemplate(
        name="rel_alternative_to.csv",
        kind="relationships",
        relationshipType="ALTERNATIVE_TO",
        fromLabel="Supplier",
        toLabel="Supplier",
        fromColumn="from",
        toColumn="to",
        description="Plan-B supplier alternatives.",
        columns=[
            {"name": "from", "type": "string"},
            {"name": "to", "type": "string"},
            {"name": "costDelta", "type": "float"},
            {"name": "leadTimeDelta", "type": "integer"},
        ],
    ),
]


@router.get("/templates")
def list_templates() -> dict[str, Any]:
    """List example CSVs under `data/csv/` for the upload form."""
    available_files = (
        {p.name for p in _TEMPLATES_DIR.iterdir()} if _TEMPLATES_DIR.exists() else set()
    )

    def annotate(t: CsvTemplate) -> dict[str, Any]:
        d = t.model_dump()
        d["available"] = t.name in available_files
        d["downloadPath"] = (
            f"data/csv/{t.name}" if d["available"] else None
        )
        return d

    return {
        "directory": str(_TEMPLATES_DIR),
        "nodes": [annotate(t) for t in _NODE_TEMPLATES],
        "relationships": [annotate(t) for t in _REL_TEMPLATES],
        "supportedTypes": list(PropertyType.__args__),
    }
