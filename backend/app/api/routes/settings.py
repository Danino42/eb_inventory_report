import logging
from email.utils import parseaddr
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.admin_pin import ADMIN_PIN
from app.api.deps import MailStore
from app.core.config import Settings, get_settings
from app.models.mail_settings import (
    MailSettings,
    MailSettingsInfo,
    RecipientsUpdate,
    TestMailResult,
)
from app.services.mail_settings_store import current_mail_settings
from app.services.mailer import SendError, build_message, can_send, from_header, send

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

Config = Annotated[Settings, Depends(get_settings)]

TEST_SUBJECT = "Earlybird Warenbestand: Test-E-Mail"
TEST_BODY = (
    "Diese Test-E-Mail wurde in der Verwaltung unter Einstellungen gesendet.\n"
    "Von diesem Absender an diese Adressen gehen auch die Warenbestand-Berichte.\n"
)


def _info(mail: MailSettings, settings: Settings) -> MailSettingsInfo:
    return MailSettingsInfo(
        recipients=mail.recipients,
        sender=parseaddr(from_header(settings, mail.sender))[1],
        email_configured=can_send(settings),
    )


# All need the PIN: the addresses are only for the Verwaltung
@router.get("/mail", dependencies=[ADMIN_PIN])
def get_mail_settings(settings: Config, store: MailStore) -> MailSettingsInfo:
    """Report recipients and the (fixed) sender."""
    return _info(current_mail_settings(store, settings), settings)


@router.put("/mail", dependencies=[ADMIN_PIN])
def save_mail_settings(
    update: RecipientsUpdate, settings: Config, store: MailStore
) -> MailSettingsInfo:
    """Saves the recipients; the sender stays as it is."""
    mail = current_mail_settings(store, settings).model_copy(
        update={"recipients": update.recipients}
    )
    store.save(mail)
    return _info(mail, settings)


@router.post("/mail/test", dependencies=[ADMIN_PIN])
def send_test_mail(update: RecipientsUpdate, settings: Config, store: MailStore) -> TestMailResult:
    """Sends a short test email to the addresses on the page (nothing is saved).

    If it fails, the answer says why (e.g. Brevo's reason), so the setup can be fixed.
    """
    if not can_send(settings):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email sending is not set up on the server")
    sender = from_header(settings, current_mail_settings(store, settings).sender)
    msg = build_message(sender, update.recipients, TEST_SUBJECT, TEST_BODY, [])
    try:
        send(settings, update.recipients, msg, [])
    except SendError as exc:
        logger.warning("Test email not sent: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return TestMailResult(sender=sender, recipients=update.recipients)
