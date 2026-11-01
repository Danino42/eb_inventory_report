import json
import os
import re
import tempfile
from pathlib import Path
from threading import Lock

from pydantic import TypeAdapter

from app.models.fruit import Fruit

_fruit_list = TypeAdapter(list[Fruit])
# Short lists (months, variants) that json.dumps would spread over many lines
_SHORT_LIST = re.compile(r'"(months|variants)": \[([^\[\]{}]*)\]')


class FruitNotFoundError(Exception):
    pass


class FruitExistsError(Exception):
    pass


class FruitStore:
    """Keeps the fruit catalogue in a JSON file (backend/data/fruits.json).

    The file stays readable and diffable in git. Writes go to a temp file first,
    so a crash never leaves a half-written catalogue.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = Lock()

    def all(self) -> list[Fruit]:
        with self._lock:
            return self._read()

    def get(self, dev_name: str) -> Fruit:
        for fruit in self.all():
            if fruit.dev_name == dev_name:
                return fruit
        raise FruitNotFoundError(dev_name)

    def create(self, fruit: Fruit) -> Fruit:
        with self._lock:
            fruits = self._read()
            if any(f.dev_name == fruit.dev_name for f in fruits):
                raise FruitExistsError(fruit.dev_name)
            fruits.append(fruit)
            self._write(fruits)
        return fruit

    def update(self, dev_name: str, fruit: Fruit) -> Fruit:
        """Replaces a fruit. fruit.dev_name may differ from dev_name to rename it."""
        with self._lock:
            fruits = self._read()
            index = next((i for i, f in enumerate(fruits) if f.dev_name == dev_name), None)
            if index is None:
                raise FruitNotFoundError(dev_name)
            if fruit.dev_name != dev_name and any(f.dev_name == fruit.dev_name for f in fruits):
                raise FruitExistsError(fruit.dev_name)
            fruits[index] = fruit
            self._write(fruits)
        return fruit

    def delete(self, dev_name: str) -> None:
        with self._lock:
            fruits = self._read()
            remaining = [f for f in fruits if f.dev_name != dev_name]
            if len(remaining) == len(fruits):
                raise FruitNotFoundError(dev_name)
            self._write(remaining)

    def _read(self) -> list[Fruit]:
        if not self.path.exists():
            return []
        return _fruit_list.validate_json(self.path.read_bytes())

    def _write(self, fruits: list[Fruit]) -> None:
        # Computed fields (box_types, months) are derived, so they are not stored
        data = [f.model_dump(exclude={"box_types", "months"}) for f in fruits]
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
