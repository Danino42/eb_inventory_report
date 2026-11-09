from typing import Protocol


class ItemNotFoundError(Exception):
    pass


class ItemExistsError(Exception):
    pass


class ItemStore[T](Protocol):
    """A list of items with a unique key (e.g. fruits by dev_name), kept in a JSON file
    (JsonListStore) or in MongoDB (MongoListStore). The API only uses these methods."""

    def all(self) -> list[T]: ...

    def get(self, item_id: str) -> T: ...

    def create(self, item: T) -> T: ...

    def update(self, item_id: str, item: T) -> T: ...

    def delete(self, item_id: str) -> None: ...
