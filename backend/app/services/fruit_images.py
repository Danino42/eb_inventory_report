"""Fruit pictures uploaded in the Verwaltung (square PNG, cropped in the browser). In MongoDB on the
server, as files during local development. The version (a hash of the picture) goes into the
picture's address, so browsers can keep it cached and still show a new picture at once."""

import hashlib
import io
import os
from pathlib import Path
from typing import Protocol

from bson import Binary
from PIL import Image, UnidentifiedImageError
from pymongo.collection import Collection

MAX_BYTES = 2_000_000
MAX_SIDE = 1024


class InvalidImageError(Exception):
    pass


def check_png(data: bytes) -> None:
    """Only small, readable PNGs (they also go into the report PDF)"""
    if len(data) > MAX_BYTES:
        raise InvalidImageError("The picture is too large (max. 2 MB)")
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format != "PNG":
                raise InvalidImageError("The picture must be a PNG")
            if max(image.size) > MAX_SIDE:
                raise InvalidImageError(f"The picture must be at most {MAX_SIDE} px wide and high")
            image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise InvalidImageError("The picture cannot be read") from exc


def version_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


class FruitImageStore(Protocol):
    def get(self, dev_name: str) -> bytes | None: ...

    def versions(self) -> dict[str, str]: ...

    def save(self, dev_name: str, data: bytes) -> str: ...

    def rename(self, old: str, new: str) -> None: ...

    def delete(self, dev_name: str) -> None: ...


class FileFruitImageStore:
    """data/fruit_images/<dev_name>.png (not in git)"""

    def __init__(self, folder: Path) -> None:
        self.folder = folder

    def _path(self, dev_name: str) -> Path:
        return self.folder / f"{dev_name}.png"

    def get(self, dev_name: str) -> bytes | None:
        path = self._path(dev_name)
        return path.read_bytes() if path.is_file() else None

    def versions(self) -> dict[str, str]:
        if not self.folder.is_dir():
            return {}
        return {p.stem: version_of(p.read_bytes()) for p in self.folder.glob("*.png")}

    def save(self, dev_name: str, data: bytes) -> str:
        self.folder.mkdir(parents=True, exist_ok=True)
        tmp = self._path(dev_name).with_suffix(".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, self._path(dev_name))
        return version_of(data)

    def rename(self, old: str, new: str) -> None:
        if self._path(old).is_file():
            os.replace(self._path(old), self._path(new))

    def delete(self, dev_name: str) -> None:
        self._path(dev_name).unlink(missing_ok=True)


class MongoFruitImageStore:
    """One document per fruit in the "fruit_images" collection"""

    def __init__(self, collection: Collection) -> None:
        self.collection = collection

    def get(self, dev_name: str) -> bytes | None:
        doc = self.collection.find_one({"_id": dev_name}, {"data": True})
        return bytes(doc["data"]) if doc else None

    def versions(self) -> dict[str, str]:
        return {d["_id"]: d["version"] for d in self.collection.find({}, {"version": True})}

    def save(self, dev_name: str, data: bytes) -> str:
        version = version_of(data)
        self.collection.replace_one(
            {"_id": dev_name}, {"data": Binary(data), "version": version}, upsert=True
        )
        return version

    def rename(self, old: str, new: str) -> None:
        doc = self.collection.find_one({"_id": old})
        if doc is None:
            return
        self.collection.replace_one(
            {"_id": new}, {"data": doc["data"], "version": doc["version"]}, upsert=True
        )
        self.collection.delete_one({"_id": old})

    def delete(self, dev_name: str) -> None:
        self.collection.delete_one({"_id": dev_name})
