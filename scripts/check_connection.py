"""CLI utility to verify connectivity to the configured Neo4j AuraDB instance.

Run from the project root with the backend's `.env` already configured:

    python -m scripts.check_connection
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make `app` importable regardless of cwd.
ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.config import get_settings  # noqa: E402
from app.db.neo4j_client import Neo4jClient, Neo4jClientError  # noqa: E402


def _sanity_check(settings) -> list[str]:
    """Detect obvious .env mistakes before opening a Bolt connection.

    Older AuraDB instances ship with NEO4J_USERNAME='neo4j', newer ones (e.g.
    2026.04) ship with NEO4J_USERNAME=AURA_INSTANCEID. We do not enforce a
    convention; we just flag empty values and trust the user's downloaded
    credentials file.
    """
    warnings: list[str] = []
    if not settings.NEO4J_USERNAME:
        warnings.append("NEO4J_USERNAME is empty.")
    if not settings.NEO4J_DATABASE:
        warnings.append("NEO4J_DATABASE is empty.")
    if settings.NEO4J_PASSWORD.get_secret_value() == "":
        warnings.append("NEO4J_PASSWORD is empty.")
    return warnings


def _detect_duplicate_keys() -> list[str]:
    """Warn the user if backend/.env contains duplicate key definitions.

    python-dotenv silently keeps the LAST value, so duplicates often cause
    'I changed it but it still picks up the old one' bugs.
    """
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    if not env_path.exists():
        return []
    seen: dict[str, int] = {}
    duplicates: list[str] = []
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key = line.split("=", 1)[0].strip()
        seen[key] = seen.get(key, 0) + 1
        if seen[key] == 2:
            duplicates.append(key)
    if duplicates:
        return [f"Duplicate keys in backend/.env (only the last value is read): {', '.join(duplicates)}"]
    return []


def main() -> int:
    settings = get_settings()
    print("Connecting to Neo4j AuraDB ...")
    print(f"  URI:      {settings.NEO4J_URI}")
    print(f"  User:     {settings.NEO4J_USERNAME}")
    print(f"  Database: {settings.NEO4J_DATABASE}")

    warnings = _sanity_check(settings) + _detect_duplicate_keys()
    if warnings:
        print()
        for w in warnings:
            print(f"  ! {w}")
        print("\nFix backend/.env and re-run.\n")
        return 2

    client = Neo4jClient(settings)
    try:
        rows = client.run('RETURN "Neo4j AuraDB connection successful" AS message')
        print(f"OK -> {rows[0]['message']}")
        return 0
    except Neo4jClientError as exc:
        print(f"FAIL -> {exc}", file=sys.stderr)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
