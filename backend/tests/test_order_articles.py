import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.routes.order_articles import get_order_article_store
from app.core.config import get_settings
from app.main import app
from app.models.order_article import OrderArticle
from app.services.json_store import JsonListStore
from app.services.mongo_store import MongoListStore


@pytest.fixture(params=["files", "mongodb"])
def client(request, tmp_path: Path, mongo_db):
    """Runs against a copy of the mock data, so tests never change data/order_articles.json.
    Every test runs twice: with the JSON file, and with MongoDB filled from that file."""
    data_file = tmp_path / "order_articles.json"
    shutil.copy(get_settings().order_articles_file, data_file)
    store = JsonListStore(data_file, OrderArticle, key="id")
    if request.param == "mongodb":
        store = MongoListStore.seeded_from(mongo_db["order_articles"], store)
    app.dependency_overrides[get_order_article_store] = lambda: store
    # Signed in to the Verwaltung: changes need the PIN
    yield TestClient(app, headers={"X-Admin-Pin": get_settings().admin_pin})
    app.dependency_overrides.clear()


NEW = {
    "supplier": "Foodextra",
    "text": "Kiwi Bio ca. 10 kg",
    "unit_price": 3.2,
    "unit": "kg",
    "ek_quantity": 10,
    "crates": 1,
    "order_quantity": 10,
    "fruit": "kiwi",
}


def test_mock_data_matches_the_printed_list(client: TestClient) -> None:
    articles = client.get("/api/order-articles").json()
    assert len(articles) == 32
    assert len({a["id"] for a in articles}) == 32
    # "Gesamt" per supplier on the paper list = sum of the Bestellmenge
    bafru = [a for a in articles if a["supplier"] == "BAFRU"]
    assert round(sum(a["order_quantity"] for a in bafru), 3) == 458.225
    oatly = next(a for a in articles if a["text"].startswith("Oatly"))
    assert (oatly["ek_quantity"], oatly["order_quantity"]) == (1, 0)  # enough in stock


def test_filter_and_search(client: TestClient) -> None:
    owiamo = client.get("/api/order-articles", params={"supplier": "Owiamo GmbH"}).json()
    assert len(owiamo) == 7
    found = client.get("/api/order-articles", params={"q": "trauben"}).json()
    assert {a["text"] for a in found} == {"Trauben blau kernlos 500g", "Trauben grün kernlos 500g"}


def test_create_update_delete(client: TestClient) -> None:
    created = client.post("/api/order-articles", json=NEW)
    assert created.status_code == 201
    article = created.json()
    assert article["id"].startswith("art-")

    changed = {**article, "order_quantity": 5, "id": "something-else"}
    updated = client.put(f"/api/order-articles/{article['id']}", json=changed).json()
    assert updated["order_quantity"] == 5
    assert updated["id"] == article["id"]  # editing never changes the id

    assert client.delete(f"/api/order-articles/{article['id']}").status_code == 204
    assert client.delete(f"/api/order-articles/{article['id']}").status_code == 404


def test_changes_need_the_pin(client: TestClient) -> None:
    no_pin = TestClient(app)  # same mock data copy, but without the PIN
    assert no_pin.get("/api/order-articles").status_code == 200
    assert no_pin.post("/api/order-articles", json=NEW).status_code == 401
    assert no_pin.delete("/api/order-articles/art-001").status_code == 401
    assert len(client.get("/api/order-articles").json()) == 32  # nothing was changed


def test_invalid_articles_are_rejected(client: TestClient) -> None:
    assert client.post("/api/order-articles", json={**NEW, "unit": "Liter"}).status_code == 422
    assert client.post("/api/order-articles", json={**NEW, "unit_price": -1}).status_code == 422
    assert client.post("/api/order-articles", json={**NEW, "supplier": ""}).status_code == 422
