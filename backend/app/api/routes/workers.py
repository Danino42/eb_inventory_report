import unicodedata
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.admin_pin import ADMIN_PIN
from app.core.config import get_settings
from app.models.worker import Worker
from app.services.database import open_list_store
from app.services.item_store import ItemExistsError, ItemNotFoundError, ItemStore
from app.services.json_store import JsonListStore

router = APIRouter(prefix="/workers", tags=["workers"])


@lru_cache
def get_worker_store() -> ItemStore[Worker]:
    # MongoDB on the server (filled once from data/workers.json), the file itself locally
    file_store = JsonListStore(get_settings().workers_file, Worker, key="name")
    return open_list_store("workers", file_store)


Store = Annotated[ItemStore[Worker], Depends(get_worker_store)]


def _sort_key(name: str) -> str:
    """Alphabetical like a German list: Ömer next to Okan, Andrés next to Andreas."""
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return plain.casefold()


def _conflict(name: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, f"'{name}' already exists")


def _taken(store: ItemStore[Worker], name: str, except_name: str | None = None) -> bool:
    """Upper / lower case does not make a different person ("ali" = "Ali")"""
    folded = name.casefold()
    return any(w.name.casefold() == folded and w.name != except_name for w in store.all())


@router.get("")
def list_workers(store: Store) -> list[str]:
    """Names for the name picker on the worker form, sorted alphabetically."""
    return sorted((w.name for w in store.all()), key=_sort_key)


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[ADMIN_PIN])
def add_worker(worker: Worker, store: Store) -> Worker:
    if _taken(store, worker.name):
        raise _conflict(worker.name)
    try:
        return store.create(worker)
    except ItemExistsError:
        raise _conflict(worker.name) from None


@router.put("/{name}", dependencies=[ADMIN_PIN])
def rename_worker(name: str, worker: Worker, store: Store) -> Worker:
    if _taken(store, worker.name, except_name=name):
        raise _conflict(worker.name)
    try:
        return store.update(name, worker)
    except ItemNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"'{name}' not found") from None
    except ItemExistsError:
        raise _conflict(worker.name) from None


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[ADMIN_PIN])
def remove_worker(name: str, store: Store) -> None:
    try:
        store.delete(name)
    except ItemNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"'{name}' not found") from None
