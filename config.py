from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/chronicle"
    alembic_database_url: str | None = None
    environment: str = "development"
    log_level: str = "INFO"
    secret_key: str = "dev-secret-key"
    api_key: str = "chronicle-dev-key"

    # LLM Configuration (Phase-1: Groq only)
    groq_api_key: str = ""
    default_llm_model: str = "llama-3.3-70b-versatile"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
