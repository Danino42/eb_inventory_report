from datetime import UTC, datetime
from typing import Any, Self

from pydantic import BaseModel
from pymongo import ASCENDING, DESCENDING
from pymongo.collection import Collection
from pymongo.errors import BulkWriteError, DuplicateKeyError

from app.services.item_store import ItemExistsError, ItemNotFoundError
from app.services.json_store import JsonListStore

# Position in the list (e.g. the catalogue order of the worker form). MongoDB keeps no order of
# its own, so it is stored with each item.
ORDER_FIELD = "_order"
DUPLICATE_KEY = 11000


class MongoListStore[T: BaseModel]:
    """Same behaviour as JsonListStore, but the items live in a MongoDB collection, so edits
    survive restarts and redeploys of the server. Unique by the key field (unique index)."""

    def __init__(
        self,
        collection: Collection,
        model: type[T],
        key: str,
        exclude: set[str] | None = None,
    ) -> None:
        self.collection = collection
        self.model = model
        self.key = key
        # Derived (computed) fields that must not be stored
        self.exclude = exclude or set()
        collection.create_index(key, unique=True)
        collection.create_index(ORDER_FIELD)

    @classmethod
    def seeded_from(cls, collection: Collection, file_store: JsonListStore[T]) -> Self:
        """A store for the same items as file_store, filled from its JSON file on first use."""
        store = cls(collection, file_store.model, file_store.key, file_store.exclude)
        store.seed_once(file_store.all())
        return store

    def _to_doc(self, item: T, order: int) -> dict[str, Any]:
        return {**item.model_dump(mode="json", exclude=self.exclude), ORDER_FIELD: order}

    def _to_item(self, doc: dict[str, Any]) -> T:
        return self.model.model_validate(
            {k: v for k, v in doc.items() if k not in ("_id", ORDER_FIELD)}
        )

    def all(self) -> list[T]:
        # _id (creation time) decides between equal positions, e.g. two items added at once
        docs = self.collection.find().sort([(ORDER_FIELD, ASCENDING), ("_id", ASCENDING)])
        return [self._to_item(d) for d in docs]

    def get(self, item_id: str) -> T:
        doc = self.collection.find_one({self.key: item_id})
        if doc is None:
            raise ItemNotFoundError(item_id)
        return self._to_item(doc)

    def create(self, item: T) -> T:
        """Adds the item at the end of the list."""
        last = self.collection.find_one(sort=[(ORDER_FIELD, DESCENDING)])
        order = last[ORDER_FIELD] + 1 if last else 0
        try:
            self.collection.insert_one(self._to_doc(item, order))
        except DuplicateKeyError:
            raise ItemExistsError(getattr(item, self.key)) from None
        return item

    def update(self, item_id: str, item: T) -> T:
        """Replaces an item and keeps its position. Its key may differ from item_id to rename it."""
        current = self.collection.find_one({self.key: item_id})
        if current is None:
            raise ItemNotFoundError(item_id)
        try:
            result = self.collection.replace_one(
                {"_id": current["_id"]}, self._to_doc(item, current[ORDER_FIELD])
            )
        except DuplicateKeyError:
            raise ItemExistsError(getattr(item, self.key)) from None
        if result.matched_count == 0:  # deleted in the meantime
            raise ItemNotFoundError(item_id)
        return item

    def delete(self, item_id: str) -> None:
        if self.collection.delete_one({self.key: item_id}).deleted_count == 0:
            raise ItemNotFoundError(item_id)

    def seed_once(self, items: list[T]) -> None:
        """First start with an empty database: copies the items (from the JSON file in the repo).

        A marker in the "meta" collection remembers that this happened, so later edits are never
        overwritten, not even deleting every item (the free Render server restarts often).
        """
        meta = self.collection.database["meta"]
        marker = {"_id": f"seeded:{self.collection.name}"}
        if meta.find_one(marker):
            return
        docs = [self._to_doc(item, n) for n, item in enumerate(items)]
        if docs:
            try:
                # Unordered: items already there (a second server process seeding at the same
                # moment, or an interrupted first try) are skipped, the others still inserted
                self.collection.insert_many(docs, ordered=False)
            except BulkWriteError as exc:
                if any(e["code"] != DUPLICATE_KEY for e in exc.details["writeErrors"]):
                    raise
        meta.update_one(
            marker, {"$set": {"items": len(docs), "at": datetime.now(UTC)}}, upsert=True
        )
