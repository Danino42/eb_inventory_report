from fastapi import APIRouter, status

from app.api.admin_pin import ADMIN_PIN

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/pin", status_code=status.HTTP_204_NO_CONTENT, dependencies=[ADMIN_PIN])
def check_pin() -> None:
    """Unlocks the Verwaltung on the tablet: 204 if the X-Admin-Pin header is right, else 401."""
