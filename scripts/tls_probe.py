"""Direct TLS handshake test against the Aura Bolt port. Useful when the
Neo4j driver fails with a generic `ServiceUnavailable: Unable to retrieve
routing information` and you want to know whether the underlying issue is
TLS, DNS, firewall, or auth.

The host and port are derived from `NEO4J_URI` in your backend `.env`.

Examples:
    python -m scripts.tls_probe
    python -m scripts.tls_probe --uri neo4j+s://other.databases.neo4j.io
"""

from __future__ import annotations

import argparse
import socket
import ssl
import sys
from pathlib import Path
from urllib.parse import urlparse

import certifi

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.config import get_settings  # noqa: E402


def _parse_host_port(uri: str) -> tuple[str, int]:
    parsed = urlparse(uri)
    host = parsed.hostname or ""
    port = parsed.port or 7687
    if not host:
        raise ValueError(f"Could not parse host from URI: {uri}")
    return host, port


def main() -> int:
    parser = argparse.ArgumentParser(description="TLS handshake probe for AuraDB.")
    parser.add_argument("--uri", default=None, help="Override NEO4J_URI from .env")
    args = parser.parse_args()

    uri = args.uri or get_settings().NEO4J_URI
    host, port = _parse_host_port(uri)

    print(f"certifi bundle: {certifi.where()}")
    print(f"OpenSSL version: {ssl.OPENSSL_VERSION}")
    print(f"Trying TLS handshake on {host}:{port} (using certifi CA bundle) ...")

    ctx = ssl.create_default_context(cafile=certifi.where())
    try:
        with socket.create_connection((host, port), timeout=10) as s:
            with ctx.wrap_socket(s, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                print(f"TLS OK -> protocol={ssock.version()}")
                print(f"  subject:  {cert.get('subject')}")
                print(f"  issuer:   {cert.get('issuer')}")
                print(f"  notAfter: {cert.get('notAfter')}")
                print(f"  SAN:      {cert.get('subjectAltName')}")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL -> {type(exc).__name__}: {exc}")
        cause = exc.__cause__ or exc.__context__
        while cause is not None:
            print(f"  caused by: {type(cause).__name__}: {cause}")
            cause = cause.__cause__ or cause.__context__
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
