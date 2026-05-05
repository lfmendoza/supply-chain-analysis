"""Detailed connectivity diagnostics for Neo4j AuraDB.

Tries the configured URI plus two safer variants and prints the full chain
of underlying errors. Useful when `check_connection.py` reports a generic
"Unable to retrieve routing information" without revealing what is actually
failing (TLS handshake, auth, protocol mismatch, etc.).
"""

from __future__ import annotations

import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from neo4j import GraphDatabase  # noqa: E402

from app.config import get_settings  # noqa: E402


def _print_error_chain(exc: BaseException) -> None:
    print("Full error chain:")
    seen: set[int] = set()
    current: BaseException | None = exc
    depth = 0
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        prefix = "  " * depth + ("-> " if depth > 0 else "* ")
        print(f"{prefix}{type(current).__name__}: {current}")
        current = current.__cause__ or current.__context__
        depth += 1


def _try_connect(label: str, uri: str, user: str, password: str, database: str | None) -> bool:
    print(f"\n--- {label} ---")
    print(f"  URI: {uri}")
    print(f"  database: {database!r}")
    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        try:
            driver.verify_connectivity()
            with driver.session(database=database) as session:
                rec = session.run("RETURN 1 AS ok").single()
                print(f"  OK  -> got value {rec['ok']}")
                return True
        finally:
            driver.close()
    except Exception as exc:  # noqa: BLE001 - we want everything
        _print_error_chain(exc)
        print()
        print("  Traceback (top frames):")
        for line in traceback.format_exc().splitlines()[-10:]:
            print(f"    {line}")
        return False


def main() -> int:
    settings = get_settings()
    user = settings.NEO4J_USERNAME
    password = settings.NEO4J_PASSWORD.get_secret_value()
    database = settings.NEO4J_DATABASE
    uri = settings.NEO4J_URI

    print("Diagnosing Neo4j AuraDB connection ...")
    print(f"  URI:      {uri}")
    print(f"  User:     {user}")
    print(f"  Database: {database}")
    print(f"  Password length: {len(password)} (no leading/trailing spaces: {password == password.strip()})")

    # Variant A: configured URI as-is.
    ok = _try_connect("Variant A: configured URI", uri, user, password, database)
    if ok:
        return 0

    # Variant B: same URI but using 'neo4j' as database (default in classic Aura).
    if database != "neo4j":
        ok = _try_connect("Variant B: database='neo4j'", uri, user, password, "neo4j")
        if ok:
            print("\nNote: NEO4J_DATABASE='neo4j' worked. Update your backend/.env accordingly.")
            return 0

    # Variant C: same URI but neo4j+ssc:// (skips strict TLS cert validation).
    if uri.startswith("neo4j+s://"):
        ssc_uri = "neo4j+ssc://" + uri.removeprefix("neo4j+s://")
        ok = _try_connect("Variant C: neo4j+ssc:// (relaxed TLS)", ssc_uri, user, password, database)
        if ok:
            print("\nNote: connection only works with neo4j+ssc://. Likely cause: corporate proxy "
                  "or outdated Windows root certificates. Update Windows Update or the certifi "
                  "package, or keep neo4j+ssc:// for local dev only.")
            return 0

    # Variant D: bolt+s:// (no client-side routing).
    if uri.startswith("neo4j+s://"):
        bolt_uri = "bolt+s://" + uri.removeprefix("neo4j+s://")
        ok = _try_connect("Variant D: bolt+s:// (no routing)", bolt_uri, user, password, database)
        if ok:
            print("\nNote: bolt+s:// works but neo4j+s:// fails. That is unusual for AuraDB but "
                  "you can use bolt+s:// as a temporary workaround.")
            return 0

    print("\nAll variants failed. Inspect the error chain above to identify the underlying cause.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
