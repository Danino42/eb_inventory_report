import asyncio

from fastapi.testclient import TestClient

from app import main
from app.services import keep_awake as keep_awake_module


def test_pings_regularly_and_survives_failures(monkeypatch) -> None:
    pinged: list[str] = []

    def fake_ping(url: str) -> None:
        pinged.append(url)
        if len(pinged) == 1:
            raise OSError("server just restarting")  # must not stop the loop

    monkeypatch.setattr(keep_awake_module, "_ping", fake_ping)

    async def run() -> None:
        task = asyncio.create_task(keep_awake_module.keep_awake("https://api.example/health", 0.01))
        while len(pinged) < 3:
            await asyncio.sleep(0.01)
        task.cancel()

    asyncio.run(asyncio.wait_for(run(), timeout=5))
    assert pinged[:3] == ["https://api.example/health"] * 3


def test_only_runs_on_render(monkeypatch) -> None:
    started: list[str] = []

    async def fake_keep_awake(url: str) -> None:
        started.append(url)

    monkeypatch.setattr(main, "keep_awake", fake_keep_awake)
    monkeypatch.setattr(main.settings, "render_external_url", "")
    with TestClient(main.app):
        pass
    assert started == []  # local development: no pinging

    monkeypatch.setattr(main.settings, "render_external_url", "https://eb-backend.onrender.com/")
    with TestClient(main.app):
        pass
    assert started == ["https://eb-backend.onrender.com/api/health"]
