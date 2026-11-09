import logging
import smtplib
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import PyMongoError

from app.core.config import Settings, get_settings
from app.models.report import DeliveryInfo, InventoryReport, ReportResult
from app.services.database import get_database
from app.services.mailer import build_message, deliver
from app.services.report_documents import build_csv, build_pdf, email_body, email_subject, file_stem
from app.services.report_log import FileReportLog, MongoReportLog, ReportLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


def get_report_log(settings: Annotated[Settings, Depends(get_settings)]) -> ReportLog:
    # MongoDB on the server (lasting history), small marker files in the outbox locally
    if settings.mongodb_uri:
        return MongoReportLog(get_database()["reports"])
    return FileReportLog(settings.outbox_dir / "sent_ids")


@router.get("/delivery")
def delivery_info(settings: Annotated[Settings, Depends(get_settings)]) -> DeliveryInfo:
    """Who receives the report email, so the tablet can show it before sending."""
    return DeliveryInfo(
        recipients=settings.report_recipients,
        email_enabled=bool(settings.smtp_host and settings.report_recipients),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def send_report(
    report: InventoryReport,
    settings: Annotated[Settings, Depends(get_settings)],
    log: Annotated[ReportLog, Depends(get_report_log)],
) -> ReportResult:
    """Turns a filled-in form into an A4 PDF + CSV and emails both to the office.

    The tablet retries reports that could not be sent (offline). If the first attempt did get
    through but the answer was lost, the retry has the same report_id and is not sent twice.
    """
    if report.report_id and (earlier := log.find(report.report_id)):
        return earlier

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
    result = ReportResult(
        delivery=delivery, recipients=settings.report_recipients, subject=subject, files=files
    )
    try:
        log.add(report, result, datetime.now(UTC))
    except (PyMongoError, OSError):
        # The email is out: answering with an error now would only make the tablet send it again
        logger.exception("Report %s was sent but could not be logged", report.report_id)
    return result
