from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file in backend/."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Earlybird Inventory Report API"
    environment: str = "development"

    # Frontend origins allowed to call the API (Vite dev server and preview by default)
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    # Fruit catalogue (seasonal calendar), edited through /api/fruits
    fruits_file: Path = BACKEND_DIR / "data" / "fruits.json"

    # Names offered in the worker form's name picker
    workers_file: Path = BACKEND_DIR / "data" / "workers.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
