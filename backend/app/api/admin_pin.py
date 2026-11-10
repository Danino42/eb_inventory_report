import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


def require_admin_pin(
    settings: Annotated[Settings, Depends(get_settings)],
    x_admin_pin: Annotated[str, Header()] = "",
) -> None:
    """Changes in the Verwaltung need the PIN; the app sends it as the X-Admin-Pin header."""
    if not secrets.compare_digest(x_admin_pin.encode(), settings.admin_pin.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong PIN")


# For routes that change data: @router.post(..., dependencies=[ADMIN_PIN])
ADMIN_PIN = Depends(require_admin_pin)
