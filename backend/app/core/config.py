from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file in backend/."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Earlybird Inventory Report API"
    environment: str = "development"

    # Frontend origins allowed to call the API (Vite dev server and preview by default)
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
