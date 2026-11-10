from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.admin_pin import ADMIN_PIN
from app.api.deps import MailStore
from app.core.config import Settings, get_settings
from app.models.mail_settings import MailSettings, MailSettingsInfo
from app.services.mail_settings_store import current_mail_settings
from app.services.mailer import can_send

router = APIRouter(prefix="/settings", tags=["settings"])

Config = Annotated[Settings, Depends(get_settings)]


def _info(mail: MailSettings, settings: Settings) -> MailSettingsInfo:
    return MailSettingsInfo(**mail.model_dump(), email_configured=can_send(settings))


# Both need the PIN: the addresses are only for the Verwaltung
@router.get("/mail", dependencies=[ADMIN_PIN])
def get_mail_settings(settings: Config, store: MailStore) -> MailSettingsInfo:
    """Report recipients (test / production) and which of them are used."""
    return _info(current_mail_settings(store, settings), settings)


@router.put("/mail", dependencies=[ADMIN_PIN])
def save_mail_settings(mail: MailSettings, settings: Config, store: MailStore) -> MailSettingsInfo:
    if not mail.recipients:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "The selected recipient list has no address"
        )
    store.save(mail)
    return _info(mail, settings)
