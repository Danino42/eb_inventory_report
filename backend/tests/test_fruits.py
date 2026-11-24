import io
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.deps import get_fruit_image_store
from app.api.routes.fruits import get_fruit_store
from app.core.config import get_settings
from app.main import app
from app.services.fruit_images import FileFruitImageStore, MongoFruitImageStore
from app.services.fruit_store import FruitStore
from app.services.mongo_store import MongoListStore


@pytest.fixture(params=["files", "mongodb"])
def client(request, tmp_path: Path, mongo_db):
    """Runs the API against a copy of the real catalogue, so tests never touch data/fruits.json.
    Every test runs twice: with the JSON file, and with MongoDB filled from that file."""
    data_file = tmp_path / "fruits.json"
    shutil.copy(get_settings().fruits_file, data_file)
    store = FruitStore(data_file)
    images = FileFruitImageStore(tmp_path / "fruit_images")
    if request.param == "mongodb":
        store = MongoListStore.seeded_from(mongo_db["fruits"], store)
        images = MongoFruitImageStore(mongo_db["fruit_images"])
    app.dependency_overrides[get_fruit_store] = lambda: store
    app.dependency_overrides[get_fruit_image_store] = lambda: images
    # Signed in to the Verwaltung: changes need the PIN
    yield TestClient(app, headers={"X-Admin-Pin": get_settings().admin_pin})
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
    # The note (small text under the name) is searched too
    assert names(client.get("/api/fruits", params={"q": "pinova"})) == {"apple_2"}
    assert names(client.get("/api/fruits", params={"q": "Blut"})) == {"orange"}


def test_variants_and_article_number(client: TestClient) -> None:
    banana = client.get("/api/fruits/banana").json()
    assert banana["variants"] == ["conventional", "bio"]
    assert banana["article_number"] == "1010"
    # Add-ons like lemons are Bio only (crossed out under "Konventionell" on the paper form)
    assert client.get("/api/fruits/lemon").json()["variants"] == ["bio"]
    assert names(client.get("/api/fruits", params={"q": "2010"})) == {"lemon"}


def test_variants_are_ordered_and_required(client: TestClient) -> None:
    fruit = {**NEW_FRUIT, "variants": ["bio", "conventional", "bio"]}
    assert client.post("/api/fruits", json=fruit).json()["variants"] == ["conventional", "bio"]
    empty = {**NEW_FRUIT, "dev_name": "quince_2", "variants": []}
    assert client.post("/api/fruits", json=empty).status_code == 422


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


def test_changes_need_the_pin(client: TestClient) -> None:
    no_pin = TestClient(app)  # same catalogue copy, but without the PIN
    assert no_pin.get("/api/fruits/banana").status_code == 200  # the worker form reads freely
    assert no_pin.post("/api/fruits", json=NEW_FRUIT).status_code == 401
    wrong = {"X-Admin-Pin": "wrong"}
    banana = client.get("/api/fruits/banana").json()
    assert no_pin.put("/api/fruits/banana", json=banana, headers=wrong).status_code == 401
    assert no_pin.delete("/api/fruits/banana", headers=wrong).status_code == 401
    assert client.get("/api/fruits/banana").status_code == 200  # nothing was changed


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


def test_crate_content(client: TestClient) -> None:
    # "Inhalt": a Hauptfrucht crate is 13.5 kg (as before it could be set), an add-on counts 1
    assert client.get("/api/fruits/banana").json()["crate_content"] == 13.5
    assert client.get("/api/fruits/lemon").json()["crate_content"] == 1
    # One decimal place; at least 0.1
    created = client.post("/api/fruits", json={**NEW_FRUIT, "crate_content": 12.345}).json()
    assert created["crate_content"] == 12.3
    zero = {**NEW_FRUIT, "dev_name": "quince_2", "crate_content": 0}
    assert client.post("/api/fruits", json=zero).status_code == 422


def test_crate_content_of_fruits_saved_before_it_existed() -> None:
    from app.models.fruit import Fruit

    hauptfrucht = {"dev_name": "kiwi", "name_en": "Kiwi", "name_de": "Kiwi", "unit": "kg"}
    hauptfrucht["availability"] = {"standard": {"category": "addon"}, "bio": {"category": "box"}}
    assert Fruit.model_validate(hauptfrucht).crate_content == 13.5
    # Add-on in every box (Trockenfrüchte, even in kg) or counted in pieces: 1
    dried = {**hauptfrucht, "availability": {"bio": {"category": "addon"}}}
    assert Fruit.model_validate(dried).crate_content == 1
    assert Fruit.model_validate({**hauptfrucht, "unit": "pcs"}).crate_content == 1


def png(color: str = "red", size: int = 8) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGBA", (size, size), color).save(buffer, format="PNG")
    return buffer.getvalue()


def upload(client: TestClient, dev_name: str, data: bytes, **kwargs):
    files = {"image": (f"{dev_name}.png", data, "image/png")}
    return client.put(f"/api/fruits/{dev_name}/image", files=files, **kwargs)


def test_uploaded_picture(client: TestClient) -> None:
    assert client.get("/api/fruits/banana").json()["image_version"] is None
    response = upload(client, "banana", png())
    assert response.status_code == 200
    version = response.json()["image_version"]

    listed = {f["dev_name"]: f for f in client.get("/api/fruits").json()}
    assert listed["banana"]["image_version"] == version
    assert listed["kiwi"]["image_version"] is None
    picture = client.get(f"/api/fruits/banana/image?v={version}")
    assert picture.headers["content-type"] == "image/png"
    assert picture.content == png()
    assert "immutable" in picture.headers["cache-control"]

    # A new picture gets a new version, so the tablet shows it at once
    assert upload(client, "banana", png("green")).json()["image_version"] != version


def test_picture_moves_with_a_renamed_fruit_and_goes_with_a_deleted_one(client: TestClient) -> None:
    client.post("/api/fruits", json=NEW_FRUIT)
    upload(client, "quince", png())
    renamed = {**NEW_FRUIT, "dev_name": "quince_bio"}
    client.put("/api/fruits/quince", json=renamed)
    assert client.get("/api/fruits/quince/image").status_code == 404
    assert client.get("/api/fruits/quince_bio/image").content == png()

    client.delete("/api/fruits/quince_bio")
    client.post("/api/fruits", json=renamed)  # same name again: no old picture comes back
    assert client.get("/api/fruits/quince_bio/image").status_code == 404


def test_invalid_pictures_are_rejected(client: TestClient) -> None:
    assert upload(client, "banana", b"not a picture").status_code == 422
    jpeg = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(jpeg, format="JPEG")
    assert upload(client, "banana", jpeg.getvalue()).status_code == 422  # the app sends PNG
    assert upload(client, "banana", png(size=2000)).status_code == 422  # too large
    assert upload(client, "no_such_fruit", png()).status_code == 404
    assert upload(TestClient(app), "banana", png()).status_code == 401  # needs the PIN
    assert client.get("/api/fruits/banana").json()["image_version"] is None


def test_dev_name_is_made_from_the_name(client: TestClient) -> None:
    without_id = {k: v for k, v in NEW_FRUIT.items() if k != "dev_name"}
    assert client.post("/api/fruits", json=without_id).json()["dev_name"] == "quince"
    # Taken: a number is added
    assert client.post("/api/fruits", json=without_id).json()["dev_name"] == "quince-2"
    assert client.post("/api/fruits", json=without_id).json()["dev_name"] == "quince-3"
    # Catalogue fruits count as taken too
    banana = {**without_id, "name_en": "Banana"}
    assert client.post("/api/fruits", json=banana).json()["dev_name"] == "banana-2"
    # No English name: made from the German one
    german_only = {**without_id, "name_en": "", "name_de": "Äpfel grün"}
    created = client.post("/api/fruits", json=german_only)
    assert created.status_code == 201
    assert created.json()["dev_name"] == "aepfel_gruen"


def test_dev_names_for_unusual_names() -> None:
    from app.services.dev_names import dev_name_for, unique_dev_name

    assert dev_name_for("Mini Watermelon") == "mini_watermelon"
    assert dev_name_for("  Crème brûlée! ") == "creme_brulee"
    assert dev_name_for("3 Kiwis") == "fruit_3_kiwis"  # must start with a letter
    assert dev_name_for("Custom 1") == "fruit_custom_1"  # custom_… is the worker form's
    assert dev_name_for("!!!") == "fruit"
    assert unique_dev_name("kiwi", {"kiwi", "kiwi-2"}) == "kiwi-3"


def test_new_fruit_without_months_is_still_listed(client: TestClient) -> None:
    # Added in the Verwaltung before its season is known: it must not vanish from the list
    client.post("/api/fruits", json={"name_de": "Kaktusfeige", "name_en": "Prickly Pear"})
    assert "prickly_pear" in names(client.get("/api/fruits"))
    assert "prickly_pear" in names(client.get("/api/fruits", params={"q": "kaktus"}))
    # Filtering by month still shows only fruits that are available then
    assert "prickly_pear" not in names(client.get("/api/fruits", params={"month": 11}))
