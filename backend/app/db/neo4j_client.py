"""Reusable Neo4j driver wrapper.

Provides a process-wide singleton `Neo4jClient` that opens the driver once
on first use, exposes simple `run` / `run_write` helpers and converts records
to plain dictionaries so the rest of the codebase never touches Neo4j types.

Errors from the driver are caught and re-raised as `Neo4jClientError` to give
callers a single exception class to handle.
"""

from __future__ import annotations

import logging
import ssl
from collections.abc import Iterable
from typing import Any

import certifi
from neo4j import READ_ACCESS, WRITE_ACCESS, GraphDatabase, Record, Result
from neo4j.exceptions import (
    AuthError,
    ClientError,
    ConfigurationError,
    Neo4jError,
    ServiceUnavailable,
)
from neo4j.graph import Node, Path, Relationship
from neo4j.spatial import Point
from neo4j.time import Date, DateTime, Duration, Time

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


def to_jsonable(value: Any) -> Any:
    """Recursively convert Neo4j driver values into JSON-friendly Python.

    The Neo4j driver returns temporal types (`neo4j.time.Date`, `DateTime`,
    `Time`, `Duration`), spatial types (`neo4j.spatial.Point`) and graph
    types (`Node`, `Relationship`, `Path`) that FastAPI cannot serialize
    directly. This helper normalises all of them to primitives that are safe
    to put into a JSON response.
    """
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (Date, DateTime, Time)):
        return value.iso_format()
    if isinstance(value, Duration):
        return str(value)
    if isinstance(value, Point):
        out: dict[str, Any] = {"srid": value.srid}
        try:
            out["longitude"] = value.x
            out["latitude"] = value.y
        except Exception:  # noqa: BLE001
            pass
        try:
            out["height"] = value.z
        except Exception:  # noqa: BLE001
            pass
        return out
    if isinstance(value, Node):
        return {
            "_kind": "node",
            "elementId": value.element_id,
            "labels": list(value.labels),
            "properties": {k: to_jsonable(v) for k, v in dict(value).items()},
        }
    if isinstance(value, Relationship):
        return {
            "_kind": "relationship",
            "elementId": value.element_id,
            "type": value.type,
            "startElementId": value.start_node.element_id if value.start_node else None,
            "endElementId": value.end_node.element_id if value.end_node else None,
            "properties": {k: to_jsonable(v) for k, v in dict(value).items()},
        }
    if isinstance(value, Path):
        return {
            "_kind": "path",
            "nodes": [to_jsonable(n) for n in value.nodes],
            "relationships": [to_jsonable(r) for r in value.relationships],
        }
    if isinstance(value, dict):
        return {k: to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [to_jsonable(v) for v in value]
    return value


_SECURE_SCHEMES = ("neo4j+s://", "bolt+s://")
_RELAXED_SCHEMES = ("neo4j+ssc://", "bolt+ssc://")


def _strip_scheme(uri: str) -> tuple[str, str]:
    for scheme in (*_SECURE_SCHEMES, *_RELAXED_SCHEMES, "neo4j://", "bolt://"):
        if uri.startswith(scheme):
            return scheme, uri[len(scheme):]
    raise ValueError(f"Unsupported URI scheme: {uri}")


def _build_driver_kwargs(uri: str) -> tuple[str, dict[str, Any]]:
    """Translate the configured URI into driver kwargs that work even when
    the OS certificate store is missing the root used by AuraDB.

    For `neo4j+s://` and `bolt+s://` we strip the `+s` variant and pass an
    explicit `ssl_context` built from the certifi root bundle. That way the
    same driver works on Windows machines whose system cert store does not
    include SSL.com's roots (which AuraDB now uses).

    For `+ssc` variants we keep the URI as-is (the driver builds a relaxed
    context internally).

    For plain `neo4j://` / `bolt://` we leave it untouched (no TLS).
    """
    scheme, rest = _strip_scheme(uri)
    if scheme in _SECURE_SCHEMES:
        downgraded = ("neo4j://" if scheme == "neo4j+s://" else "bolt://") + rest
        ctx = ssl.create_default_context(cafile=certifi.where())
        return downgraded, {"encrypted": True, "ssl_context": ctx}
    return uri, {}


class Neo4jClientError(RuntimeError):
    """Wrapper exception for any error originating from the Neo4j driver."""


def _record_to_dict(record: Record) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in record.keys():
        out[key] = record[key]
    return out


def _record_to_jsonable(record: Record) -> dict[str, Any]:
    return {key: to_jsonable(record[key]) for key in record.keys()}


class Neo4jClient:
    """Thin wrapper around the official Neo4j Python driver.

    Connection is opened lazily, verified once, and closed on `close()`.
    Sessions are short-lived: one per `run`/`run_write` call.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._driver = None  # set on first use

    @property
    def database(self) -> str:
        return self._settings.NEO4J_DATABASE

    def _ensure_driver(self):  # noqa: ANN202 - driver type is internal
        if self._driver is None:
            try:
                effective_uri, extra_kwargs = _build_driver_kwargs(self._settings.NEO4J_URI)
                # Silence routine 'unrecognized property/relationship' warnings: they are
                # expected in our flow because _baseline* properties only exist after a
                # disruption is applied, and IMPACTS only exists after the first scenario.
                self._driver = GraphDatabase.driver(
                    effective_uri,
                    auth=(
                        self._settings.NEO4J_USERNAME,
                        self._settings.NEO4J_PASSWORD.get_secret_value(),
                    ),
                    notifications_min_severity="OFF",
                    **extra_kwargs,
                )
                self._driver.verify_connectivity()
                logger.info(
                    "Neo4j driver connected (uri=%s effective=%s db=%s)",
                    self._settings.NEO4J_URI,
                    effective_uri,
                    self._settings.NEO4J_DATABASE,
                )
            except AuthError as exc:
                raise Neo4jClientError(
                    "Invalid Neo4j credentials. Verify NEO4J_USERNAME and NEO4J_PASSWORD against "
                    "the credentials file Aura gave you when the instance was created. Note that "
                    "in some Aura versions the username is the AURA_INSTANCEID, not 'neo4j'."
                ) from exc
            except ServiceUnavailable as exc:
                raise Neo4jClientError(
                    "Cannot reach Neo4j AuraDB. Likely causes: instance paused (resume it from "
                    "console.neo4j.io), wrong NEO4J_URI, wrong username/password (auth manifests "
                    "as a routing failure in newer drivers), or a firewall blocking Bolt+TLS. "
                    f"Underlying driver message: {exc}"
                ) from exc
            except ConfigurationError as exc:
                raise Neo4jClientError(f"Neo4j driver configuration error: {exc}") from exc
            except Neo4jError as exc:
                raise Neo4jClientError(f"Neo4j driver error: {exc}") from exc
        return self._driver

    def verify_connectivity(self) -> None:
        """Force the driver to open and check connectivity.

        Raises Neo4jClientError on failure.
        """
        self._ensure_driver()

    def close(self) -> None:
        if self._driver is not None:
            try:
                self._driver.close()
            finally:
                self._driver = None
                logger.info("Neo4j driver closed")

    def run(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
        database: str | None = None,
    ) -> list[dict[str, Any]]:
        """Execute a read query and return materialized rows."""
        driver = self._ensure_driver()
        db = database or self.database
        try:
            with driver.session(database=db) as session:
                result: Result = session.run(cypher, params or {})
                return [_record_to_dict(r) for r in result]
        except Neo4jError as exc:
            raise Neo4jClientError(f"Cypher execution failed: {exc.message}") from exc

    def run_write(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
        database: str | None = None,
    ) -> list[dict[str, Any]]:
        """Execute a write query inside a managed transaction."""
        driver = self._ensure_driver()
        db = database or self.database

        def _work(tx, cypher_inner: str, params_inner: dict[str, Any]):
            result = tx.run(cypher_inner, params_inner)
            return [_record_to_dict(r) for r in result]

        try:
            with driver.session(database=db) as session:
                return session.execute_write(_work, cypher, params or {})
        except Neo4jError as exc:
            raise Neo4jClientError(f"Cypher write failed: {exc.message}") from exc

    def run_in_mode(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
        mode: str = "read",
        database: str | None = None,
        timeout_seconds: float | None = None,
    ) -> dict[str, Any]:
        """Execute a Cypher statement with explicit access mode and JSON-safe rows.

        Used by the public Cypher Explorer endpoint. In `read` mode the driver
        opens a read session, so any `CREATE`/`MERGE`/`SET`/`REMOVE`/`DELETE`
        will be rejected by Aura with a `ForbiddenWriteOnReadOnlyDatabase`-like
        error before touching the graph.
        """
        driver = self._ensure_driver()
        db = database or self.database
        access = READ_ACCESS if mode == "read" else WRITE_ACCESS
        try:
            with driver.session(database=db, default_access_mode=access) as session:
                # Per-transaction timeout is set on `begin_transaction` (not on
                # execute_read/write) in the modern neo4j driver.
                tx = (
                    session.begin_transaction(timeout=timeout_seconds)
                    if timeout_seconds is not None
                    else session.begin_transaction()
                )
                try:
                    result = tx.run(cypher, params or {})
                    rows = [_record_to_jsonable(r) for r in result]
                    summary = result.consume()
                    if mode == "write":
                        tx.commit()
                    else:
                        tx.rollback()
                except Exception:
                    tx.rollback()
                    raise
                counters = summary.counters
                return {
                    "mode": mode,
                    "rows": rows,
                    "rowCount": len(rows),
                    "stats": {
                        "nodesCreated": counters.nodes_created,
                        "nodesDeleted": counters.nodes_deleted,
                        "relationshipsCreated": counters.relationships_created,
                        "relationshipsDeleted": counters.relationships_deleted,
                        "propertiesSet": counters.properties_set,
                        "labelsAdded": counters.labels_added,
                        "labelsRemoved": counters.labels_removed,
                        "indexesAdded": counters.indexes_added,
                        "indexesRemoved": counters.indexes_removed,
                        "constraintsAdded": counters.constraints_added,
                        "constraintsRemoved": counters.constraints_removed,
                        "containsUpdates": counters.contains_updates,
                    },
                }
        except ClientError as exc:
            raise Neo4jClientError(
                f"Cypher rejected by Neo4j: {exc.code or ''} {exc.message or exc}".strip()
            ) from exc
        except Neo4jError as exc:
            raise Neo4jClientError(f"Cypher execution failed: {exc.message}") from exc

    def run_jsonable(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
        write: bool = False,
        database: str | None = None,
    ) -> list[dict[str, Any]]:
        """Internal helper for endpoints that want JSON-safe rows from a single statement."""
        driver = self._ensure_driver()
        db = database or self.database
        access = WRITE_ACCESS if write else READ_ACCESS
        try:
            with driver.session(database=db, default_access_mode=access) as session:
                if write:
                    def _w(tx):
                        return [_record_to_jsonable(r) for r in tx.run(cypher, params or {})]

                    return session.execute_write(_w)
                else:
                    def _r(tx):
                        return [_record_to_jsonable(r) for r in tx.run(cypher, params or {})]

                    return session.execute_read(_r)
        except Neo4jError as exc:
            raise Neo4jClientError(f"Cypher execution failed: {exc.message}") from exc

    def run_many(
        self,
        statements: Iterable[tuple[str, dict[str, Any] | None]],
        database: str | None = None,
    ) -> None:
        """Execute multiple statements sequentially in a single write transaction."""
        driver = self._ensure_driver()
        db = database or self.database

        def _work(tx, stmts):
            for cypher, params in stmts:
                tx.run(cypher, params or {})

        items = list(statements)
        try:
            with driver.session(database=db) as session:
                session.execute_write(_work, items)
        except Neo4jError as exc:
            raise Neo4jClientError(f"Batch write failed: {exc.message}") from exc


_singleton: Neo4jClient | None = None


def get_neo4j_client() -> Neo4jClient:
    """Return the process-wide Neo4jClient singleton."""
    global _singleton
    if _singleton is None:
        _singleton = Neo4jClient()
    return _singleton


def reset_neo4j_client() -> None:
    """Used by FastAPI shutdown hooks and tests."""
    global _singleton
    if _singleton is not None:
        _singleton.close()
        _singleton = None
