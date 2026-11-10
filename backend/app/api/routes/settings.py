import logging
from email.utils import parseaddr
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.admin_pin import ADMIN_PIN
from app.api.deps import MailStore
from app.core.config import Settings, get_settings
from app.models.mail_settings import MailSettings, MailSettingsInfo, TestMailResult
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
        **mail.model_dump(),
        email_configured=can_send(settings),
        server_sender=parseaddr(settings.smtp_from)[1],
    )


def _require_recipients(mail: MailSettings) -> None:
    if not mail.recipients:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "The selected recipient list has no address"
        )


# All need the PIN: the addresses are only for the Verwaltung
@router.get("/mail", dependencies=[ADMIN_PIN])
def get_mail_settings(settings: Config, store: MailStore) -> MailSettingsInfo:
    """Report recipients (test / production), which of them are used, and the sender."""
    return _info(current_mail_settings(store, settings), settings)


@router.put("/mail", dependencies=[ADMIN_PIN])
def save_mail_settings(mail: MailSettings, settings: Config, store: MailStore) -> MailSettingsInfo:
    _require_recipients(mail)
    store.save(mail)
    return _info(mail, settings)


@router.post("/mail/test", dependencies=[ADMIN_PIN])
def send_test_mail(mail: MailSettings, settings: Config) -> TestMailResult:
    """Sends a short test email with the settings as they are on the page (nothing is saved).

    If it fails, the answer says why (e.g. Brevo's reason), so the setup can be fixed.
    """
    if not can_send(settings):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email sending is not set up on the server")
    _require_recipients(mail)
    sender = from_header(settings, mail.sender)
    msg = build_message(sender, mail.recipients, TEST_SUBJECT, TEST_BODY, [])
    try:
        send(settings, mail.recipients, msg, [])
    except SendError as exc:
        logger.warning("Test email not sent: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return TestMailResult(sender=sender, recipients=mail.recipients)
