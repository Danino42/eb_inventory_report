from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.services.database import database_status

router = APIRouter(tags=["health"])


@router.get("/health")
def health(settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, str]:
    """Lets the frontend (and hosting platforms) check that the API is reachable.

    Also shows where data is kept: "files" (JSON files, local development) or "mongodb", plus
    whether the database answers ("ok", "login failed", "unreachable", ...).
    """
    if not settings.mongodb_uri:
        return {"status": "ok", "storage": "files"}
    return {"status": "ok", "storage": "mongodb", "database": database_status()}
