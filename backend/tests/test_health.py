from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_origin_pattern_for_hosted_frontend() -> None:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    from app.core.config import Settings

    pattern = Settings(cors_origin_regex=r"https://eb-inventory-report(-[a-z0-9-]+)?\.vercel\.app")
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
    ok = "https://eb-inventory-report-git-main-danino42.vercel.app"
    response = c.options("/ping", headers={**headers, "Origin": ok})
    assert response.headers.get("access-control-allow-origin") == ok
    other = "https://evil-site.vercel.app"
    response = c.options("/ping", headers={**headers, "Origin": other})
    assert "access-control-allow-origin" not in response.headers


def test_cors_allows_vite_dev_server() -> None:
    response = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
