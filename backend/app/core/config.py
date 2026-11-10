from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file in backend/."""

    # Empty values count as not set (e.g. REPORT_RECIPIENTS left blank in the Render dashboard),
    # so the default applies instead of the server failing to start
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", env_ignore_empty=True
    )

    app_name: str = "Earlybird Inventory Report API"
    environment: str = "development"

    # Frontend origins allowed to call the API (Vite dev server and preview by default)
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]
    # Optional pattern for hosted frontends whose address may vary, e.g. a suffixed Render address
    cors_origin_regex: str | None = None

    # Fruit catalogue (seasonal calendar), edited through /api/fruits
    fruits_file: Path = BACKEND_DIR / "data" / "fruits.json"

    # Regularly ordered articles (supplier order list); mock data until the Access import exists
    order_articles_file: Path = BACKEND_DIR / "data" / "order_articles.json"

    # Names offered in the worker form's name picker
    workers_file: Path = BACKEND_DIR / "data" / "workers.json"

    # 4-digit PIN of the Verwaltung: opens it on the tablet, and the server only accepts changes
    # to the catalogue and order articles with it. A shared lock against changes by mistake,
    # not a login. Set ADMIN_PIN on the server to change it.
    admin_pin: str = Field(default="7777", pattern=r"^\d{4}$")

    # MongoDB, e.g. a free MongoDB Atlas cluster. If set, the fruit catalogue, order articles and
    # sent reports are kept there for good (the JSON files above only fill it on first start).
    # If empty, everything stays in the JSON files and the outbox folder.
    mongodb_uri: str = ""
    mongodb_db: str = "eb_inventory"

    # Inventory reports: who receives the PDF + CSV email (test / production addresses). Only the
    # starting values: once the Verwaltung settings page is saved, its addresses are used
    report_recipients: list[str] = []
    production_recipients: list[str] = []
    # Where that page is saved without MongoDB (local development; not in git)
    mail_settings_file: Path = BACKEND_DIR / "data" / "mail_settings.local.json"

    # Sending: Brevo's email API (over HTTPS, so it works on Render's free plan, which blocks the
    # SMTP ports) or SMTP. With neither, emails are only saved to outbox_dir (as .eml).
    brevo_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    # Sender of the emails (with Brevo: an address verified as sender there)
    smtp_from: str = "Earlybird Warenbestand <noreply@earlybird.local>"
    # Every report email (+ PDF, CSV) is also kept here as a copy
    outbox_dir: Path = BACKEND_DIR / "outbox"
    # Icons for the PDF: the same files the app shows (fruit_icons/<dev_name>.png, ifco.png)
    images_dir: Path = BACKEND_DIR.parent / "frontend" / "src" / "images"


@lru_cache
def get_settings() -> Settings:
    return Settings()
