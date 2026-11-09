import json
import os
import re
import tempfile
from pathlib import Path
from threading import Lock

from pydantic import BaseModel, TypeAdapter

from app.services.item_store import ItemExistsError, ItemNotFoundError

# Short lists (months, variants) that json.dumps would spread over many lines
_SHORT_LIST = re.compile(r'"(months|variants)": \[([^\[\]{}]*)\]')


class JsonListStore[T: BaseModel]:
    """Keeps a list of items in a JSON file (e.g. backend/data/fruits.json).

    Items are identified by one field (key). The file stays readable and diffable in git.
    Writes go to a temp file first, so a crash never leaves a half-written file.
    """

    def __init__(self, path: Path, model: type[T], key: str, exclude: set[str] | None = None):
        self.path = path
        self.model = model
        self.key = key
        # Derived (computed) fields that must not be written to the file
        self.exclude = exclude or set()
        self._list = TypeAdapter(list[model])
        self._lock = Lock()

    def _id(self, item: T) -> str:
        return getattr(item, self.key)

    def all(self) -> list[T]:
        with self._lock:
            return self._read()

    def get(self, item_id: str) -> T:
        for item in self.all():
            if self._id(item) == item_id:
                return item
        raise ItemNotFoundError(item_id)

    def create(self, item: T) -> T:
        with self._lock:
            items = self._read()
            if any(self._id(i) == self._id(item) for i in items):
                raise ItemExistsError(self._id(item))
            items.append(item)
            self._write(items)
        return item

    def update(self, item_id: str, item: T) -> T:
        """Replaces an item. Its key may differ from item_id to rename it."""
        with self._lock:
            items = self._read()
            index = next((n for n, i in enumerate(items) if self._id(i) == item_id), None)
            if index is None:
                raise ItemNotFoundError(item_id)
            new_id = self._id(item)
            if new_id != item_id and any(self._id(i) == new_id for i in items):
                raise ItemExistsError(new_id)
            items[index] = item
            self._write(items)
        return item

    def delete(self, item_id: str) -> None:
        with self._lock:
            items = self._read()
            remaining = [i for i in items if self._id(i) != item_id]
            if len(remaining) == len(items):
                raise ItemNotFoundError(item_id)
            self._write(remaining)

    def _read(self) -> list[T]:
        if not self.path.exists():
            return []
        return self._list.validate_json(self.path.read_bytes())

    def _write(self, items: list[T]) -> None:
        data = [i.model_dump(exclude=self.exclude) for i in items]
        text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        # Keep short lists on one line, so the file stays short and git diffs stay readable
        text = _SHORT_LIST.sub(
            lambda m: (
                f'"{m.group(1)}": ['
                + ", ".join(i.strip() for i in m.group(2).split(",") if i.strip())
                + "]"
            ),
            text,
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        os.replace(tmp, self.path)
