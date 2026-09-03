"""Application configuration, loaded from environment variables / .env.

See docker-compose.yml for how DATABASE_URL and REDIS_URL are supplied in
the containerized dev environment.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Evaluation Service"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://eval_service:eval_service@postgres:5432/eval_service"
    redis_url: str = "redis://redis:6379/0"

    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
