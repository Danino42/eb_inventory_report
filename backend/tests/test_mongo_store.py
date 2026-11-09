import pytest
from pymongo.database import Database

from app.core.config import get_settings
from app.services.fruit_store import FruitStore
from app.services.item_store import ItemExistsError, ItemNotFoundError
from app.services.mongo_store import ORDER_FIELD, MongoListStore


@pytest.fixture
def catalogue() -> FruitStore:
    return FruitStore(get_settings().fruits_file)


def test_first_start_copies_the_catalogue_in_order(mongo_db: Database, catalogue) -> None:
    store = MongoListStore.seeded_from(mongo_db["fruits"], catalogue)
    assert [f.dev_name for f in store.all()] == [f.dev_name for f in catalogue.all()]
    raw = mongo_db["fruits"].find_one({"dev_name": "banana"})
    # Stored like in the JSON file: computed fields are left out
    assert "box_types" not in raw and "months" not in raw
    assert raw[ORDER_FIELD] == 0


def test_edits_survive_a_restart(mongo_db: Database, catalogue) -> None:
    store = MongoListStore.seeded_from(mongo_db["fruits"], catalogue)
    for fruit in store.all():
        store.delete(fruit.dev_name)
    # The free Render server restarts often: the JSON file must not fill the list again
    again = MongoListStore.seeded_from(mongo_db["fruits"], catalogue)
    assert again.all() == []


def test_new_items_go_last_and_renames_keep_their_place(mongo_db: Database, catalogue) -> None:
    store = MongoListStore.seeded_from(mongo_db["fruits"], catalogue)
    banana = store.get("banana")
    store.create(banana.model_copy(update={"dev_name": "banana_2"}))
    assert store.all()[-1].dev_name == "banana_2"

    first = store.all()[0].dev_name
    store.update(first, store.get(first).model_copy(update={"dev_name": "renamed"}))
    assert store.all()[0].dev_name == "renamed"


def test_duplicates_and_missing_items(mongo_db: Database, catalogue) -> None:
    store = MongoListStore.seeded_from(mongo_db["fruits"], catalogue)
    kiwi = store.get("kiwi")
    with pytest.raises(ItemExistsError):
        store.create(kiwi)
    with pytest.raises(ItemExistsError):
        store.update("banana", kiwi)
    with pytest.raises(ItemNotFoundError):
        store.update("no_such_fruit", kiwi)
    with pytest.raises(ItemNotFoundError):
        store.delete("no_such_fruit")
