"""Graph CRUD for the Operations Lab: generic labels/rel types, `TypedProperty` → Neo4j native types."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from neo4j.spatial import WGS84Point
from neo4j.time import Date as Neo4jDate
from neo4j.time import DateTime as Neo4jDateTime
from pydantic import BaseModel, Field, field_validator

from app.db.neo4j_client import Neo4jClientError, get_neo4j_client, to_jsonable

logger = logging.getLogger(__name__)

router = APIRouter(tags=["graph-operations"])


# Identifiers in Cypher must be alphanumeric + underscore. We never inject
# user input as literal label/relType without validating against this regex.
_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _validate_identifier(name: str, kind: str) -> str:
    if not _IDENT.match(name):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {kind} '{name}'. Must match [A-Za-z_][A-Za-z0-9_]*.",
        )
    return name


PropertyType = Literal[
    "string", "integer", "float", "boolean", "date", "datetime", "list", "point"
]


class TypedProperty(BaseModel):
    key: str = Field(..., description="Property name")
    type: PropertyType
    value: Any

    @field_validator("key")
    @classmethod
    def _validate_key(cls, v: str) -> str:
        if not _IDENT.match(v):
            raise ValueError("Property key must be a valid Cypher identifier")
        return v


class CreateNodeBody(BaseModel):
    labels: list[str] = Field(..., min_length=1)
    properties: list[TypedProperty] = Field(default_factory=list)


class UpdateNodeBody(BaseModel):
    set: list[TypedProperty] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class CreateRelationshipBody(BaseModel):
    startId: str
    endId: str
    type: str
    properties: list[TypedProperty] = Field(default_factory=list)
    startLabel: str | None = None
    endLabel: str | None = None


class UpdateRelationshipBody(BaseModel):
    set: list[TypedProperty] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class RewireRelationshipBody(BaseModel):
    newType: str | None = None
    newStartId: str | None = None
    newEndId: str | None = None
    flipDirection: bool = False


def _convert_value(prop: TypedProperty) -> Any:
    """Convert a typed property to a Neo4j-driver-friendly Python value."""
    t, v = prop.type, prop.value
    if t == "string":
        return None if v is None else str(v)
    if t == "integer":
        return None if v is None else int(v)
    if t == "float":
        return None if v is None else float(v)
    if t == "boolean":
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes")
        return bool(v)
    if t == "date":
        if v is None:
            return None
        if isinstance(v, str):
            d = datetime.fromisoformat(v.split("T", 1)[0]).date()
            return Neo4jDate(d.year, d.month, d.day)
        raise ValueError(f"date value must be ISO string, got {type(v).__name__}")
    if t == "datetime":
        if v is None:
            return None
        if isinstance(v, str):
            iso = v.replace("Z", "+00:00")
            dt = datetime.fromisoformat(iso)
            return Neo4jDateTime.from_native(dt)
        raise ValueError(f"datetime value must be ISO string, got {type(v).__name__}")
    if t == "list":
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("list value must be a JSON array")
        return list(v)
    if t == "point":
        if v is None:
            return None
        if not isinstance(v, dict) or "latitude" not in v or "longitude" not in v:
            raise ValueError("point value must be {latitude, longitude}")
        return WGS84Point((float(v["longitude"]), float(v["latitude"])))
    raise ValueError(f"Unsupported type: {t}")


def _props_dict(props: list[TypedProperty]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for p in props:
        try:
            out[p.key] = _convert_value(p)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid value for property '{p.key}' (type={p.type}): {exc}",
            ) from exc
    return out


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


@router.post("/graph/nodes")
def create_node(body: CreateNodeBody) -> dict:
    """Create a node with one or more labels and typed properties."""
    labels = [_validate_identifier(label, "label") for label in body.labels]
    props = _props_dict(body.properties)
    label_clause = ":".join(f"`{label}`" for label in labels)
    cypher = (
        f"CREATE (n:{label_clause}) SET n = $props "
        "RETURN elementId(n) AS elementId, labels(n) AS labels, properties(n) AS properties"
    )
    try:
        rows = get_neo4j_client().run_jsonable(cypher, {"props": props}, write=True)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=500, detail="Node creation returned no row")
    return rows[0]


def _match_node_clause(by: str = "id") -> str:
    if by == "elementId":
        return "MATCH (n) WHERE elementId(n) = $key"
    return "MATCH (n {id: $key})"


@router.patch("/graph/nodes/{key}")
def update_node(
    key: str,
    body: UpdateNodeBody,
    by: Literal["id", "elementId"] = Query("id"),
) -> dict:
    """Set and/or remove typed properties on a node."""
    set_props = _props_dict(body.set)
    remove_keys = [_validate_identifier(k, "property") for k in body.remove]
    parts = [_match_node_clause(by)]
    if set_props:
        parts.append("SET n += $props")
    if remove_keys:
        remove_clause = ", ".join(f"n.{k}" for k in remove_keys)
        parts.append(f"REMOVE {remove_clause}")
    parts.append(
        "RETURN elementId(n) AS elementId, labels(n) AS labels, properties(n) AS properties"
    )
    cypher = "\n".join(parts)
    try:
        rows = get_neo4j_client().run_jsonable(
            cypher, {"key": key, "props": set_props}, write=True
        )
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=404, detail=f"Node not found: {key}")
    return rows[0]


@router.delete("/graph/nodes/{key}")
def delete_node(
    key: str,
    detach: bool = Query(True),
    by: Literal["id", "elementId"] = Query("id"),
) -> dict:
    """Delete a node. With `detach=true` (default) drops its relationships first."""
    cypher = _match_node_clause(by) + (
        " WITH n, properties(n) AS props, labels(n) AS labels DETACH DELETE n RETURN labels, props"
        if detach
        else " WITH n, properties(n) AS props, labels(n) AS labels DELETE n RETURN labels, props"
    )
    try:
        rows = get_neo4j_client().run_jsonable(cypher, {"key": key}, write=True)
    except Neo4jClientError as exc:
        # Most likely a node-with-relationships error when detach=false.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=404, detail=f"Node not found: {key}")
    return {"deleted": True, "labels": rows[0]["labels"], "properties": rows[0]["props"]}


@router.delete("/graph/nodes/{key}/properties/{prop}")
def delete_node_property(
    key: str,
    prop: str,
    by: Literal["id", "elementId"] = Query("id"),
) -> dict:
    """Remove a single property from a node."""
    _validate_identifier(prop, "property")
    cypher = (
        _match_node_clause(by)
        + f" REMOVE n.{prop} RETURN elementId(n) AS elementId, labels(n) AS labels, properties(n) AS properties"
    )
    try:
        rows = get_neo4j_client().run_jsonable(cypher, {"key": key}, write=True)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=404, detail=f"Node not found: {key}")
    return rows[0]


# ---------------------------------------------------------------------------
# Relationships
# ---------------------------------------------------------------------------


def _match_rel_clause() -> str:
    return "MATCH ()-[r]->() WHERE elementId(r) = $relId"


def _node_match_for_create(var: str, label: str | None) -> str:
    if label:
        _validate_identifier(label, "label")
        return f"MATCH ({var}:`{label}` {{id: ${var}Id}})"
    return f"MATCH ({var} {{id: ${var}Id}})"


@router.post("/graph/relationships")
def create_relationship(body: CreateRelationshipBody) -> dict:
    """Create a relationship between two existing nodes (matched by `id`)."""
    rel_type = _validate_identifier(body.type, "relationship type")
    props = _props_dict(body.properties)
    cypher = (
        _node_match_for_create("start", body.startLabel)
        + " "
        + _node_match_for_create("end", body.endLabel)
        + f"\nCREATE (start)-[r:`{rel_type}`]->(end) SET r = $props"
        " RETURN elementId(r) AS elementId, type(r) AS type,"
        " elementId(start) AS startElementId, elementId(end) AS endElementId,"
        " start.id AS startId, end.id AS endId,"
        " properties(r) AS properties"
    )
    params = {"startId": body.startId, "endId": body.endId, "props": props}
    try:
        rows = get_neo4j_client().run_jsonable(cypher, params, write=True)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=(
                f"One of the nodes was not found "
                f"(startId={body.startId}, endId={body.endId})."
            ),
        )
    return rows[0]


@router.patch("/graph/relationships/{rel_id:path}")
def update_relationship(rel_id: str, body: UpdateRelationshipBody) -> dict:
    """Set and/or remove properties of a relationship."""
    set_props = _props_dict(body.set)
    remove_keys = [_validate_identifier(k, "property") for k in body.remove]
    parts = [_match_rel_clause()]
    if set_props:
        parts.append("SET r += $props")
    if remove_keys:
        remove_clause = ", ".join(f"r.{k}" for k in remove_keys)
        parts.append(f"REMOVE {remove_clause}")
    parts.append(
        "RETURN elementId(r) AS elementId, type(r) AS type, properties(r) AS properties"
    )
    cypher = "\n".join(parts)
    try:
        rows = get_neo4j_client().run_jsonable(
            cypher, {"relId": rel_id, "props": set_props}, write=True
        )
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=404, detail=f"Relationship not found: {rel_id}")
    return rows[0]


@router.post("/graph/relationships/{rel_id:path}/rewire")
def rewire_relationship(rel_id: str, body: RewireRelationshipBody) -> dict:
    """Re-create the relationship with a different type, direction or endpoints.

    Neo4j cannot mutate the type, direction or endpoints of an existing
    relationship; we copy properties to a new relationship and delete the old
    one in the same transaction.
    """
    new_type = body.newType
    if new_type is not None:
        _validate_identifier(new_type, "relationship type")
    cypher = """
    MATCH (s)-[r]->(t) WHERE elementId(r) = $relId
    WITH s, t, r, type(r) AS oldType, properties(r) AS props
    OPTIONAL MATCH (ns) WHERE $newStartId IS NOT NULL AND ns.id = $newStartId
    OPTIONAL MATCH (nt) WHERE $newEndId IS NOT NULL AND nt.id = $newEndId
    WITH r, props, oldType,
         coalesce(ns, s) AS resolvedStart,
         coalesce(nt, t) AS resolvedEnd,
         coalesce($newType, oldType) AS resolvedType,
         $flip AS flip
    CALL apoc.do.when(
        flip,
        'CREATE (a)-[nr:`' + resolvedType + '`]->(b) RETURN nr',
        'CREATE (a)-[nr:`' + resolvedType + '`]->(b) RETURN nr',
        {a: CASE WHEN flip THEN resolvedEnd ELSE resolvedStart END,
         b: CASE WHEN flip THEN resolvedStart ELSE resolvedEnd END}
    ) YIELD value
    WITH r, props, value.nr AS nr
    SET nr = props
    DELETE r
    RETURN elementId(nr) AS elementId, type(nr) AS type,
           elementId(startNode(nr)) AS startElementId,
           elementId(endNode(nr)) AS endElementId,
           startNode(nr).id AS startId, endNode(nr).id AS endId,
           properties(nr) AS properties
    """
    params = {
        "relId": rel_id,
        "newType": new_type,
        "newStartId": body.newStartId,
        "newEndId": body.newEndId,
        "flip": body.flipDirection,
    }
    # APOC may not be available; fall back to a pure-Cypher implementation
    # that requires us to build the type into the string.
    try:
        rows = get_neo4j_client().run_jsonable(cypher, params, write=True)
        if rows:
            return rows[0]
    except Neo4jClientError as exc:
        logger.info("APOC rewire path failed (%s); falling back to pure Cypher.", exc)

    # Pure-Cypher fallback. We need to know oldType to build the CREATE clause,
    # so we read it first.
    fetch = (
        "MATCH (s)-[r]->(t) WHERE elementId(r) = $relId "
        "RETURN type(r) AS oldType, properties(r) AS props, s.id AS sId, t.id AS tId"
    )
    try:
        meta = get_neo4j_client().run_jsonable(fetch, {"relId": rel_id})
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not meta:
        raise HTTPException(status_code=404, detail=f"Relationship not found: {rel_id}")
    old_type = meta[0]["oldType"]
    props = meta[0]["props"] or {}
    s_id = body.newStartId or meta[0]["sId"]
    t_id = body.newEndId or meta[0]["tId"]
    if body.flipDirection:
        s_id, t_id = t_id, s_id
    resolved_type = new_type or old_type
    _validate_identifier(resolved_type, "relationship type")
    rebuild = (
        "MATCH (s {id: $sId}), (t {id: $tId}) "
        f"CREATE (s)-[nr:`{resolved_type}`]->(t) SET nr = $props "
        "WITH nr "
        "MATCH ()-[old]->() WHERE elementId(old) = $relId DELETE old "
        "RETURN elementId(nr) AS elementId, type(nr) AS type, "
        "elementId(startNode(nr)) AS startElementId, "
        "elementId(endNode(nr)) AS endElementId, "
        "startNode(nr).id AS startId, endNode(nr).id AS endId, "
        "properties(nr) AS properties"
    )
    try:
        rows = get_neo4j_client().run_jsonable(
            rebuild,
            {"sId": s_id, "tId": t_id, "props": props, "relId": rel_id},
            write=True,
        )
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Failed to rewire relationship")
    return rows[0]


@router.delete("/graph/relationships/{rel_id:path}")
def delete_relationship(rel_id: str) -> dict:
    """Delete a relationship by element id."""
    cypher = (
        _match_rel_clause()
        + " WITH r, type(r) AS t, properties(r) AS p DELETE r RETURN t AS type, p AS properties"
    )
    try:
        rows = get_neo4j_client().run_jsonable(cypher, {"relId": rel_id}, write=True)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=404, detail=f"Relationship not found: {rel_id}")
    return {"deleted": True, **rows[0]}


@router.delete("/graph/relationships/{rel_id:path}/properties/{prop}")
def delete_relationship_property(rel_id: str, prop: str) -> dict:
    """Remove a single property from a relationship."""
    _validate_identifier(prop, "property")
    cypher = (
        _match_rel_clause()
        + f" REMOVE r.{prop} RETURN elementId(r) AS elementId, type(r) AS type, properties(r) AS properties"
    )
    try:
        rows = get_neo4j_client().run_jsonable(cypher, {"relId": rel_id}, write=True)
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(status_code=404, detail=f"Relationship not found: {rel_id}")
    return rows[0]


# ---------------------------------------------------------------------------
# Read helpers used by the Operations Lab list views
# ---------------------------------------------------------------------------


@router.get("/graph/nodes")
def list_nodes(
    label: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    search: str | None = Query(None, description="Match against `id` or `name`."),
) -> dict:
    """List nodes with optional label filter, pagination and free-text search."""
    where: list[str] = []
    if search:
        where.append("(toLower(toString(coalesce(n.id, ''))) CONTAINS toLower($q) "
                     "OR toLower(toString(coalesce(n.name, ''))) CONTAINS toLower($q))")
    if label:
        _validate_identifier(label, "label")
        match = f"MATCH (n:`{label}`)"
    else:
        match = "MATCH (n)"
    where_clause = ("WHERE " + " AND ".join(where)) if where else ""
    cypher = (
        f"{match}\n{where_clause}\n"
        "RETURN elementId(n) AS elementId, labels(n) AS labels, properties(n) AS properties\n"
        "ORDER BY coalesce(toString(n.id), '') ASC SKIP $skip LIMIT $limit"
    )
    try:
        rows = get_neo4j_client().run_jsonable(
            cypher, {"q": search or "", "skip": skip, "limit": limit}
        )
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"items": rows, "skip": skip, "limit": limit}


@router.get("/graph/labels")
def list_labels() -> dict:
    rows = get_neo4j_client().run("CALL db.labels() YIELD label RETURN label ORDER BY label")
    return {"labels": [r["label"] for r in rows]}


@router.get("/graph/relationship-types")
def list_relationship_types() -> dict:
    rows = get_neo4j_client().run(
        "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType"
    )
    return {"relationshipTypes": [r["relationshipType"] for r in rows]}


@router.get("/graph/relationships")
def list_relationships(
    rel_type: str | None = Query(None, alias="type"),
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
) -> dict:
    if rel_type:
        _validate_identifier(rel_type, "relationship type")
        match = f"MATCH (s)-[r:`{rel_type}`]->(t)"
    else:
        match = "MATCH (s)-[r]->(t)"
    cypher = (
        f"{match}\n"
        "RETURN elementId(r) AS elementId, type(r) AS type,\n"
        "       s.id AS startId, labels(s)[0] AS startLabel, elementId(s) AS startElementId,\n"
        "       t.id AS endId,   labels(t)[0] AS endLabel,   elementId(t) AS endElementId,\n"
        "       properties(r) AS properties\n"
        "SKIP $skip LIMIT $limit"
    )
    try:
        rows = get_neo4j_client().run_jsonable(cypher, {"skip": skip, "limit": limit})
    except Neo4jClientError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"items": rows, "skip": skip, "limit": limit}
