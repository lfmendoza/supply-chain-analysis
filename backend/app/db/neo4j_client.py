"""Reusable Neo4j driver wrapper.

Provides a process-wide singleton `Neo4jClient` that opens the driver once
on first use, exposes simple `run` / `run_write` helpers and converts records
to plain dictionaries so the rest of the codebase never touches Neo4j types.

Errors from the driver are caught and re-raised as `Neo4jClientError` to give
callers a single exception class to handle.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Any

from neo4j import GraphDatabase, Record, Result
from neo4j.exceptions import (
    AuthError,
    ConfigurationError,
    Neo4jError,
    ServiceUnavailable,
)

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class Neo4jClientError(RuntimeError):
    """Wrapper exception for any error originating from the Neo4j driver."""


def _record_to_dict(record: Record) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in record.keys():
        out[key] = record[key]
    return out


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
                self._driver = GraphDatabase.driver(
                    self._settings.NEO4J_URI,
                    auth=(
                        self._settings.NEO4J_USERNAME,
                        self._settings.NEO4J_PASSWORD.get_secret_value(),
                    ),
                )
                self._driver.verify_connectivity()
                logger.info(
                    "Neo4j driver connected (uri=%s, db=%s)",
                    self._settings.NEO4J_URI,
                    self._settings.NEO4J_DATABASE,
                )
            except AuthError as exc:
                raise Neo4jClientError("Invalid Neo4j credentials") from exc
            except ServiceUnavailable as exc:
                raise Neo4jClientError(
                    "Cannot reach Neo4j AuraDB. Check URI, network, and instance status."
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
