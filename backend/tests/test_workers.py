import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.routes.workers import get_worker_store
from app.core.config import get_settings
from app.main import app
from app.models.worker import Worker
from app.services.json_store import JsonListStore
from app.services.mongo_store import MongoListStore


@pytest.fixture(params=["files", "mongodb"])
def client(request, tmp_path: Path, mongo_db):
    """Runs against a copy of data/workers.json (the starting list), never the file itself.
    Every test runs twice: with the JSON file, and with MongoDB filled from that file."""
    data_file = tmp_path / "workers.json"
    shutil.copy(get_settings().workers_file, data_file)
    store = JsonListStore(data_file, Worker, key="name")
    if request.param == "mongodb":
        store = MongoListStore.seeded_from(mongo_db["workers"], store)
    app.dependency_overrides[get_worker_store] = lambda: store
    # Signed in to the Verwaltung: changes need the PIN
    yield TestClient(app, headers={"X-Admin-Pin": get_settings().admin_pin})
    app.dependency_overrides.clear()


def names(client: TestClient) -> list[str]:
    return client.get("/api/workers").json()


def test_workers_are_sorted_names(client: TestClient) -> None:
    listed = names(client)
    assert len(listed) == 22
    assert listed[0] == "Alfred"
    # Umlauts sort like their base letter: Okan, Ömer, Pidi
    assert listed.index("Okan") + 1 == listed.index("Ömer") == listed.index("Pidi") - 1


def test_add_rename_remove(client: TestClient) -> None:
    assert client.post("/api/workers", json={"name": "  Zoë "}).status_code == 201
    assert "Zoë" in names(client)  # spaces around the name are dropped
    assert client.put("/api/workers/Zoë", json={"name": "Zoe Muster"}).status_code == 200
    assert "Zoe Muster" in names(client) and "Zoë" not in names(client)
    assert client.delete("/api/workers/Zoe Muster").status_code == 204
    assert client.delete("/api/workers/Zoe Muster").status_code == 404
    assert len(names(client)) == 22


def test_names_stay_unique_and_valid(client: TestClient) -> None:
    # Same person regardless of upper / lower case
    assert client.post("/api/workers", json={"name": "daniel"}).status_code == 409
    assert client.put("/api/workers/Tim", json={"name": "OKAN"}).status_code == 409
    # Changing only the case of the own name is fine
    assert client.put("/api/workers/Tim", json={"name": "TIM"}).status_code == 200
    for bad in ("", "   ", "A/B", "x" * 61):
        assert client.post("/api/workers", json={"name": bad}).status_code == 422
    assert client.put("/api/workers/Nobody", json={"name": "Somebody"}).status_code == 404


def test_changes_need_the_pin(client: TestClient) -> None:
    no_pin = TestClient(app)
    assert no_pin.get("/api/workers").status_code == 200  # the name picker reads freely
    assert no_pin.post("/api/workers", json={"name": "Eve"}).status_code == 401
    assert no_pin.delete("/api/workers/Tim").status_code == 401
    assert len(names(client)) == 22


def test_starting_list_of_plain_names_is_read() -> None:
    # data/workers.json is a plain list of names; edits are saved as {"name": ...}
    assert Worker.model_validate("Ömer").name == "Ömer"
