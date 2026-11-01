import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.routes.fruits import get_fruit_store
from app.core.config import get_settings
from app.main import app
from app.services.fruit_store import FruitStore


@pytest.fixture
def client(tmp_path: Path):
    """Runs the API against a copy of the real catalogue, so tests never touch data/fruits.json."""
    data_file = tmp_path / "fruits.json"
    shutil.copy(get_settings().fruits_file, data_file)
    app.dependency_overrides[get_fruit_store] = lambda: FruitStore(data_file)
    yield TestClient(app)
    app.dependency_overrides.clear()


def names(response) -> set[str]:
    return {f["dev_name"] for f in response.json()}


NEW_FRUIT = {
    "dev_name": "quince",
    "name_en": "Quince",
    "name_de": "Quitte",
    "unit": "kg",
    "availability": {"bio": {"category": "box", "months": [11, 10, 10]}},
}


def test_catalogue_is_valid_and_unique(client: TestClient) -> None:
    fruits = client.get("/api/fruits").json()
    assert len(fruits) == 30
    assert len({f["dev_name"] for f in fruits}) == len(fruits)


def test_filter_by_month_and_box(client: TestClient) -> None:
    # Apfel II is all year in Spezial, but only April-November in Standard
    assert "apple_2" in names(client.get("/api/fruits", params={"month": 1, "box_type": "spezial"}))
    assert "apple_2" not in names(
        client.get("/api/fruits", params={"month": 1, "box_type": "standard"})
    )


def test_filter_by_category_is_per_box(client: TestClient) -> None:
    # Kiwi is an add-on in Standard but a box fruit in Bio
    params = {"box_type": "standard", "category": "addon"}
    assert "kiwi" in names(client.get("/api/fruits", params=params))
    params = {"box_type": "bio", "category": "addon"}
    assert "kiwi" not in names(client.get("/api/fruits", params=params))


def test_search(client: TestClient) -> None:
    assert names(client.get("/api/fruits", params={"q": "apfel"})) == {"apple_gala", "apple_2"}


def test_derived_fields(client: TestClient) -> None:
    kaki = client.get("/api/fruits/kaki").json()
    assert kaki["box_types"] == ["standard", "spezial", "bio"]
    assert kaki["months"] == [1, 10, 11, 12]


def test_create_update_rename_delete(client: TestClient) -> None:
    created = client.post("/api/fruits", json=NEW_FRUIT)
    assert created.status_code == 201
    assert created.json()["availability"]["bio"]["months"] == [10, 11]
    assert client.post("/api/fruits", json=NEW_FRUIT).status_code == 409

    renamed = {**NEW_FRUIT, "dev_name": "quince_bio", "unit": "pcs"}
    assert client.put("/api/fruits/quince", json=renamed).status_code == 200
    assert client.get("/api/fruits/quince").status_code == 404
    assert client.get("/api/fruits/quince_bio").json()["unit"] == "pcs"

    assert client.delete("/api/fruits/quince_bio").status_code == 204
    assert client.delete("/api/fruits/quince_bio").status_code == 404


def test_rename_onto_existing_fruit_is_rejected(client: TestClient) -> None:
    banana = client.get("/api/fruits/banana").json()
    response = client.put("/api/fruits/banana", json={**banana, "dev_name": "kiwi"})
    assert response.status_code == 409


def test_invalid_input_is_rejected(client: TestClient) -> None:
    bad_month = {**NEW_FRUIT, "availability": {"bio": {"months": [13]}}}
    assert client.post("/api/fruits", json=bad_month).status_code == 422
    bad_name = {**NEW_FRUIT, "dev_name": "Quince Fruit"}
    assert client.post("/api/fruits", json=bad_name).status_code == 422
    bad_box = {**NEW_FRUIT, "availability": {"deluxe": {"months": [1]}}}
    assert client.post("/api/fruits", json=bad_box).status_code == 422


def test_saved_file_keeps_compact_format(tmp_path: Path) -> None:
    store = FruitStore(tmp_path / "fruits.json")
    store.create(FruitStore(get_settings().fruits_file).get("banana"))
    text = (tmp_path / "fruits.json").read_text(encoding="utf-8")
    assert '"months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]' in text
    assert "box_types" not in text
