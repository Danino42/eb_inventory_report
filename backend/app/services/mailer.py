"""Sends a report email via SMTP, and always keeps a copy (.eml + attachments) in the outbox."""

import smtplib
from datetime import datetime
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from typing import Literal

from app.core.config import Settings


def build_message(
    settings: Settings,
    subject: str,
    body: str,
    attachments: list[tuple[str, bytes, str]],
) -> EmailMessage:
    """attachments: (file name, content, MIME type)"""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(settings.report_recipients)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="earlybird.local")
    msg.set_content(body)
    for name, content, mime in attachments:
        maintype, subtype = mime.split("/", 1)
        msg.add_attachment(content, maintype=maintype, subtype=subtype, filename=name)
    return msg


def deliver(
    settings: Settings,
    msg: EmailMessage,
    attachments: list[tuple[str, bytes, str]],
    stem: str,
) -> tuple[Literal["sent", "saved"], list[str]]:
    """Saves the email and its attachments to the outbox; sends it if SMTP is configured.

    Returns the delivery mode and the saved file names.
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

    if not settings.smtp_host or not settings.report_recipients:
        return "saved", saved
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)
    return "sent", saved
