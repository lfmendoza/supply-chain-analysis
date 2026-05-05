"""Database access layer (Neo4j driver wrapper and Cypher templates)."""

from app.db.neo4j_client import Neo4jClient, get_neo4j_client

__all__ = ["Neo4jClient", "get_neo4j_client"]
