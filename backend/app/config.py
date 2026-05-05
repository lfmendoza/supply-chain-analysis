"""Centralized application configuration loaded from environment variables.

Uses pydantic-settings to validate values at startup. Never log
the password or print the full settings object in production code.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Strongly typed settings populated from `.env` or process env.

    Search order: `backend/.env` first, then project-root `.env` (if present).
    """

    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    NEO4J_URI: str = Field(..., description="Bolt+s URI of the AuraDB instance.")
    NEO4J_USERNAME: str = Field(default="neo4j")
    NEO4J_PASSWORD: SecretStr = Field(..., description="Password for the AuraDB user.")
    NEO4J_DATABASE: str = Field(default="neo4j")

    APP_ENV: str = Field(default="development")
    LOG_LEVEL: str = Field(default="INFO")

    BACKEND_HOST: str = Field(default="0.0.0.0")
    BACKEND_PORT: int = Field(default=8000)

    CORS_ORIGINS: str = Field(default="http://localhost:5173,http://127.0.0.1:5173")

    @field_validator("NEO4J_URI")
    @classmethod
    def _validate_uri(cls, value: str) -> str:
        if not value:
            raise ValueError("NEO4J_URI is required")
        allowed_prefixes = ("neo4j+s://", "neo4j+ssc://", "bolt+s://", "bolt+ssc://", "neo4j://", "bolt://")
        if not value.startswith(allowed_prefixes):
            raise ValueError(
                "NEO4J_URI must start with one of: " + ", ".join(allowed_prefixes)
            )
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    def safe_repr(self) -> dict[str, str]:
        """Representation safe for logging (no password)."""
        return {
            "NEO4J_URI": self.NEO4J_URI,
            "NEO4J_USERNAME": self.NEO4J_USERNAME,
            "NEO4J_DATABASE": self.NEO4J_DATABASE,
            "APP_ENV": self.APP_ENV,
            "LOG_LEVEL": self.LOG_LEVEL,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached accessor; instantiate Settings at most once per process."""
    return Settings()  # type: ignore[call-arg]
