from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.models.fruit import BoxType, Category, Fruit, Unit
from app.services.fruit_store import FruitExistsError, FruitNotFoundError, FruitStore

router = APIRouter(prefix="/fruits", tags=["fruits"])


@lru_cache
def get_fruit_store() -> FruitStore:
    # One shared store, so its lock serialises concurrent writes to the file
    return FruitStore(get_settings().fruits_file)


Store = Annotated[FruitStore, Depends(get_fruit_store)]


@router.get("")
def list_fruits(
    store: Store,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
    box_type: BoxType | None = None,
    category: Category | None = None,
    unit: Unit | None = None,
    q: Annotated[str | None, Query(description="Search in dev, English and German name")] = None,
) -> list[Fruit]:
    """All fruits, optionally filtered. month/box_type/category are checked per box type,
    e.g. month=10&box_type=bio returns what the Bio box offers in October."""
    fruits = [f for f in store.all() if f.is_available(month, box_type, category)]
    if unit:
        fruits = [f for f in fruits if f.unit == unit]
    if q:
        needle = q.strip().lower()
        fruits = [
            f
            for f in fruits
            if needle in f.dev_name or needle in f.name_en.lower() or needle in f.name_de.lower()
        ]
    return fruits


@router.get("/{dev_name}")
def get_fruit(dev_name: str, store: Store) -> Fruit:
    try:
        return store.get(dev_name)
    except FruitNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Fruit '{dev_name}' not found") from None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_fruit(fruit: Fruit, store: Store) -> Fruit:
    try:
        return store.create(fruit)
    except FruitExistsError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Fruit '{fruit.dev_name}' already exists"
        ) from None


@router.put("/{dev_name}")
def update_fruit(dev_name: str, fruit: Fruit, store: Store) -> Fruit:
    try:
        return store.update(dev_name, fruit)
    except FruitNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Fruit '{dev_name}' not found") from None
    except FruitExistsError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Fruit '{fruit.dev_name}' already exists"
        ) from None


@router.delete("/{dev_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fruit(dev_name: str, store: Store) -> None:
    try:
        store.delete(dev_name)
    except FruitNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Fruit '{dev_name}' not found") from None
