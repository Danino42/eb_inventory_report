from functools import lru_cache
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import get_settings
from app.models.order_article import OrderArticle
from app.services.database import open_list_store
from app.services.item_store import ItemExistsError, ItemNotFoundError, ItemStore
from app.services.json_store import JsonListStore

router = APIRouter(prefix="/order-articles", tags=["order articles"])


@lru_cache
def get_order_article_store() -> ItemStore[OrderArticle]:
    # MongoDB on the server, data/order_articles.json locally. One shared store, so with the
    # file its lock serialises concurrent writes.
    file_store = JsonListStore(get_settings().order_articles_file, OrderArticle, key="id")
    return open_list_store("order_articles", file_store)


Store = Annotated[ItemStore[OrderArticle], Depends(get_order_article_store)]


def _not_found(article_id: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, f"Article '{article_id}' not found")


@router.get("")
def list_order_articles(
    store: Store,
    supplier: str | None = None,
    q: Annotated[str | None, Query(description="Search in article text and supplier")] = None,
) -> list[OrderArticle]:
    """Regularly ordered articles in list order (mock data until the Access import exists)."""
    articles = store.all()
    if supplier:
        articles = [a for a in articles if a.supplier == supplier]
    if q:
        needle = q.strip().lower()
        articles = [a for a in articles if needle in a.text.lower() or needle in a.supplier.lower()]
    return articles


@router.post("", status_code=status.HTTP_201_CREATED)
def create_order_article(article: OrderArticle, store: Store) -> OrderArticle:
    if not article.id:
        article = article.model_copy(update={"id": f"art-{uuid4().hex[:8]}"})
    try:
        return store.create(article)
    except ItemExistsError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Article '{article.id}' already exists"
        ) from None


@router.put("/{article_id}")
def update_order_article(article_id: str, article: OrderArticle, store: Store) -> OrderArticle:
    # The id never changes through editing
    article = article.model_copy(update={"id": article_id})
    try:
        return store.update(article_id, article)
    except ItemNotFoundError:
        raise _not_found(article_id) from None


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order_article(article_id: str, store: Store) -> None:
    try:
        store.delete(article_id)
    except ItemNotFoundError:
        raise _not_found(article_id) from None
