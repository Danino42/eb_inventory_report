import smtplib
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.models.report import InventoryReport, ReportResult
from app.services.mailer import build_message, deliver
from app.services.report_documents import build_csv, build_pdf, email_body, email_subject, file_stem

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", status_code=status.HTTP_201_CREATED)
def send_report(
    report: InventoryReport, settings: Annotated[Settings, Depends(get_settings)]
) -> ReportResult:
    """Turns a filled-in form into an A4 PDF + CSV and emails both to the office."""
    stem = file_stem(report)
    attachments = [
        (f"{stem}.pdf", build_pdf(report, datetime.now(), settings.images_dir), "application/pdf"),
        (f"{stem}.csv", build_csv(report), "text/csv"),
    ]
    subject = email_subject(report)
    msg = build_message(settings, subject, email_body(report), attachments)
    try:
        delivery, files = deliver(settings, msg, attachments, stem)
    except (smtplib.SMTPException, OSError) as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Die E-Mail konnte nicht gesendet werden. Bitte später nochmals versuchen.",
        ) from exc
    return ReportResult(
        delivery=delivery, recipients=settings.report_recipients, subject=subject, files=files
    )
