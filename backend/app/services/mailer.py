"""Sends a report email (Brevo API or SMTP), and always keeps a copy (.eml + attachments) in the
outbox."""

import base64
import json
import smtplib
import urllib.request
from datetime import datetime
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr
from typing import Literal

from app.core.config import Settings

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def can_send(settings: Settings) -> bool:
    """True if a way of sending is set up (otherwise emails are only saved)"""
    return bool(settings.brevo_api_key or settings.smtp_host)


def build_message(
    settings: Settings,
    recipients: list[str],
    subject: str,
    body: str,
    attachments: list[tuple[str, bytes, str]],
) -> EmailMessage:
    """attachments: (file name, content, MIME type)"""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    if recipients:
        msg["To"] = ", ".join(recipients)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="earlybird.local")
    msg.set_content(body)
    for name, content, mime in attachments:
        maintype, subtype = mime.split("/", 1)
        msg.add_attachment(content, maintype=maintype, subtype=subtype, filename=name)
    return msg


def deliver(
    settings: Settings,
    recipients: list[str],
    msg: EmailMessage,
    attachments: list[tuple[str, bytes, str]],
    stem: str,
) -> tuple[Literal["sent", "saved"], list[str]]:
    """Saves the email and its attachments to the outbox; sends it if sending is set up.

    Returns the delivery mode and the saved file names. Raises OSError / SMTPException if
    sending fails.
    """
    folder = settings.outbox_dir
    folder.mkdir(parents=True, exist_ok=True)
    # Timestamp keeps a second report for the same day from overwriting the first; a counter
    # covers several reports in the same second (e.g. queued reports sent one after another)
    prefix = f"{stem}_{datetime.now():%H%M%S}"
    n = 2
    while (folder / f"{prefix}.eml").exists():
        prefix = f"{stem}_{datetime.now():%H%M%S}_{n}"
        n += 1
    saved = [f"{prefix}.eml"]
    (folder / saved[0]).write_bytes(msg.as_bytes())
    for name, content, _ in attachments:
        file_name = f"{prefix}{name[len(stem) :]}" if name.startswith(stem) else f"{prefix}_{name}"
        (folder / file_name).write_bytes(content)
        saved.append(file_name)

    if not recipients or not can_send(settings):
        return "saved", saved
    if settings.brevo_api_key:
        _send_with_brevo(settings, recipients, msg, attachments)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    return "sent", saved


def _send_with_brevo(
    settings: Settings,
    recipients: list[str],
    msg: EmailMessage,
    attachments: list[tuple[str, bytes, str]],
) -> None:
    """Brevo's transactional email API. The sender must be verified in the Brevo account."""
    name, address = parseaddr(settings.smtp_from)
    body = msg.get_body(preferencelist=("plain",))
    payload = {
        "sender": {"name": name or "Earlybird Warenbestand", "email": address},
        "to": [{"email": r} for r in recipients],
        "subject": msg["Subject"],
        "textContent": body.get_content() if body else "",
        "attachment": [
            {"name": file_name, "content": base64.b64encode(content).decode("ascii")}
            for file_name, content, _ in attachments
        ],
    }
    request = urllib.request.Request(
        BREVO_URL,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "api-key": settings.brevo_api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    # HTTPError (e.g. wrong key, sender not verified) is an OSError, like SMTP connection errors
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read()
