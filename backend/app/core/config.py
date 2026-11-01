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
    # Optional pattern for hosted frontends whose address changes, e.g. Vercel preview deployments
    cors_origin_regex: str | None = None

    # Fruit catalogue (seasonal calendar), edited through /api/fruits
    fruits_file: Path = BACKEND_DIR / "data" / "fruits.json"

    # Names offered in the worker form's name picker
    workers_file: Path = BACKEND_DIR / "data" / "workers.json"

    # Inventory reports: who receives the PDF + CSV email
    report_recipients: list[str] = []
    # SMTP for sending; if smtp_host is empty, emails are only saved to outbox_dir (as .eml)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Earlybird Warenbestand <noreply@earlybird.local>"
    # Every report email (+ PDF, CSV) is also kept here as a copy
    outbox_dir: Path = BACKEND_DIR / "outbox"
    # Icons for the PDF: the same files the app shows (fruit_icons/<dev_name>.png, ifco.png)
    images_dir: Path = BACKEND_DIR.parent / "frontend" / "src" / "images"


@lru_cache
def get_settings() -> Settings:
    return Settings()
