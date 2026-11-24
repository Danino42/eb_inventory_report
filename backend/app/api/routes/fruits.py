from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel

from app.api.admin_pin import ADMIN_PIN
from app.api.deps import ImageStore
from app.core.config import get_settings
from app.models.fruit import BoxType, Category, Fruit, FruitOut, NewFruit, Unit
from app.services.database import open_list_store
from app.services.dev_names import dev_name_for, unique_dev_name
from app.services.fruit_images import MAX_BYTES, InvalidImageError, check_png
from app.services.fruit_store import FruitExistsError, FruitNotFoundError, FruitStore
from app.services.item_store import ItemStore

router = APIRouter(prefix="/fruits", tags=["fruits"])


@lru_cache
def get_fruit_store() -> ItemStore[Fruit]:
    # MongoDB on the server, data/fruits.json locally. One shared store, so with the file its
    # lock serialises concurrent writes.
    return open_list_store("fruits", FruitStore(get_settings().fruits_file))


Store = Annotated[ItemStore[Fruit], Depends(get_fruit_store)]


class ImageInfo(BaseModel):
    image_version: str


def _not_found(dev_name: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"Fruit '{dev_name}' not found")


def _with_image(fruit: Fruit, versions: dict[str, str]) -> FruitOut:
    return FruitOut(**fruit.model_dump(), image_version=versions.get(fruit.dev_name))


@router.get("")
def list_fruits(
    store: Store,
    images: ImageStore,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
    box_type: BoxType | None = None,
    category: Category | None = None,
    unit: Unit | None = None,
    q: Annotated[
        str | None, Query(description="Search in dev name, names, article number and note")
    ] = None,
) -> list[FruitOut]:
    """All fruits, optionally filtered. month/box_type/category are checked per box type,
    e.g. month=10&box_type=bio returns what the Bio box offers in October."""
    fruits = store.all()
    # Without these filters every fruit is listed, also new ones without any months yet
    if month or box_type or category:
        fruits = [f for f in fruits if f.is_available(month, box_type, category)]
    if unit:
        fruits = [f for f in fruits if f.unit == unit]
    if q:
        needle = q.strip().lower()
        fruits = [
            f
            for f in fruits
            if needle in f.dev_name
            or needle in f.name_en.lower()
            or needle in f.name_de.lower()
            or needle in f.article_number.lower()
            or needle in f.note.lower()
        ]
    versions = images.versions()
    return [_with_image(f, versions) for f in fruits]


@router.get("/{dev_name}")
def get_fruit(dev_name: str, store: Store, images: ImageStore) -> FruitOut:
    try:
        return _with_image(store.get(dev_name), images.versions())
    except FruitNotFoundError:
        raise _not_found(dev_name) from None


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[ADMIN_PIN])
def create_fruit(new: NewFruit, store: Store) -> Fruit:
    """Adds a fruit. Without a dev name one is made from the English name (else the German
    one), e.g. "banana"; if another fruit has it already: "banana-2", "banana-3", ..."""
    data = new.model_dump()
    if new.dev_name:
        try:
            return store.create(Fruit.model_validate(data))
        except FruitExistsError:
            raise HTTPException(
                status.HTTP_409_CONFLICT, f"Fruit '{new.dev_name}' already exists"
            ) from None
    base = dev_name_for(new.name_en.strip() or new.name_de)
    # Tried again if another fruit takes the same name at the same moment
    for _ in range(5):
        taken = {f.dev_name for f in store.all()}
        try:
            return store.create(
                Fruit.model_validate({**data, "dev_name": unique_dev_name(base, taken)})
            )
        except FruitExistsError:
            continue
    raise HTTPException(status.HTTP_409_CONFLICT, f"No free dev name for '{new.name_de}'")


@router.put("/{dev_name}", dependencies=[ADMIN_PIN])
def update_fruit(dev_name: str, fruit: Fruit, store: Store, images: ImageStore) -> Fruit:
    try:
        saved = store.update(dev_name, fruit)
    except FruitNotFoundError:
        raise _not_found(dev_name) from None
    except FruitExistsError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Fruit '{fruit.dev_name}' already exists"
        ) from None
    if fruit.dev_name != dev_name:
        # The picture belongs to the fruit, so it moves along with a new dev name
        images.rename(dev_name, fruit.dev_name)
    return saved


@router.delete("/{dev_name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[ADMIN_PIN])
def delete_fruit(dev_name: str, store: Store, images: ImageStore) -> None:
    try:
        store.delete(dev_name)
    except FruitNotFoundError:
        raise _not_found(dev_name) from None
    images.delete(dev_name)


@router.get("/{dev_name}/image")
def get_fruit_image(dev_name: str, images: ImageStore) -> Response:
    """The uploaded picture (PNG). The app asks for it with ?v=<version>, so it can be cached."""
    data = images.get(dev_name)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No picture for '{dev_name}'")
    return Response(
        data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.put("/{dev_name}/image", dependencies=[ADMIN_PIN])
def upload_fruit_image(
    dev_name: str, image: UploadFile, store: Store, images: ImageStore
) -> ImageInfo:
    """Saves the fruit's picture: a square PNG, cropped in the Verwaltung."""
    try:
        store.get(dev_name)
    except FruitNotFoundError:
        raise _not_found(dev_name) from None
    data = image.file.read(MAX_BYTES + 1)
    try:
        check_png(data)
    except InvalidImageError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    return ImageInfo(image_version=images.save(dev_name, data))
