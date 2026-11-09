from pathlib import Path

from app.models.fruit import Fruit
from app.services.json_store import ItemExistsError, ItemNotFoundError, JsonListStore

# Kept under these names so existing imports keep working
FruitNotFoundError = ItemNotFoundError
FruitExistsError = ItemExistsError


class FruitStore(JsonListStore[Fruit]):
    """The fruit catalogue in backend/data/fruits.json, identified by dev_name."""

    def __init__(self, path: Path) -> None:
        # Computed fields (box_types, months) are derived, so they are not stored
        super().__init__(path, Fruit, key="dev_name", exclude={"box_types", "months"})
