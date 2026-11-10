import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ConfigurationError, OperationFailure, ServerSelectionTimeoutError

from app.api.routes import health
from app.core.config import Settings, get_settings
from app.main import app
from app.services import database

client = TestClient(app)


@pytest.fixture
def use_settings():
    def use(**values) -> None:
        settings = Settings(**values)
        app.dependency_overrides[get_settings] = lambda: settings

    yield use
    app.dependency_overrides.clear()


def test_health_returns_ok(use_settings) -> None:
    use_settings(mongodb_uri="")
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "storage": "files"}


def test_health_shows_whether_mongodb_answers(use_settings, monkeypatch) -> None:
    use_settings(mongodb_uri="mongodb+srv://user:secret@cluster0.example.mongodb.net")
    monkeypatch.setattr(health, "database_status", lambda: "ok")
    assert client.get("/api/health").json()["database"] == "ok"
    monkeypatch.setattr(health, "database_status", lambda: "unreachable")
    response = client.get("/api/health")
    # The API itself still runs, so the server is not restarted; the problem is visible here
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "storage": "mongodb", "database": "unreachable"}


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (None, "ok"),
        (OperationFailure("bad auth : authentication failed", code=8000), "login failed"),
        (ConfigurationError("The DNS query name does not exist"), "invalid connection string"),
        (ServerSelectionTimeoutError("connection closed"), "unreachable"),
    ],
)
def test_database_status_names_the_setup_mistake(monkeypatch, mongo_db, error, expected) -> None:
    def failing_command(*args, **kwargs):
        raise error

    if error:
        monkeypatch.setattr(mongo_db, "command", failing_command)
    monkeypatch.setattr(database, "get_database", lambda: mongo_db)
    assert database.database_status() == expected


def test_cors_origin_pattern_for_hosted_frontend() -> None:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    from app.core.config import Settings

    pattern = Settings(
        cors_origin_regex=r"^https://eb-inventory-report(-[a-z0-9-]+)?\.onrender\.com$"
    )
    demo = FastAPI()
    demo.add_middleware(
        CORSMiddleware,
        allow_origins=pattern.cors_origins,
        allow_origin_regex=pattern.cors_origin_regex,
        allow_methods=["*"],
    )
    demo.get("/ping")(lambda: "pong")
    c = TestClient(demo)
    headers = {"Access-Control-Request-Method": "GET"}
    ok = "https://eb-inventory-report-k3x9.onrender.com"
    response = c.options("/ping", headers={**headers, "Origin": ok})
    assert response.headers.get("access-control-allow-origin") == ok
    other = "https://evil-site.onrender.com"
    response = c.options("/ping", headers={**headers, "Origin": other})
    assert "access-control-allow-origin" not in response.headers


def test_blank_settings_fall_back_to_defaults(monkeypatch) -> None:
    # Secrets left empty in the Render dashboard must not stop the server from starting
    for name in ("REPORT_RECIPIENTS", "CORS_ORIGINS", "SMTP_PORT", "MONGODB_URI"):
        monkeypatch.setenv(name, "")
    settings = Settings(_env_file=None)
    assert settings.report_recipients == []
    assert settings.cors_origins == ["http://localhost:5173", "http://localhost:4173"]
    assert (settings.smtp_port, settings.mongodb_uri) == (587, "")


def test_cors_allows_vite_dev_server() -> None:
    response = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
