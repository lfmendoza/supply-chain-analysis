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


def main() -> int:
    settings = get_settings()
    print("Connecting to Neo4j AuraDB ...")
    print(f"  URI:      {settings.NEO4J_URI}")
    print(f"  User:     {settings.NEO4J_USERNAME}")
    print(f"  Database: {settings.NEO4J_DATABASE}")

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
