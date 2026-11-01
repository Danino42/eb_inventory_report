import smtplib
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.models.report import DeliveryInfo, InventoryReport, ReportResult
from app.services.mailer import build_message, deliver
from app.services.report_documents import build_csv, build_pdf, email_body, email_subject, file_stem

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/delivery")
def delivery_info(settings: Annotated[Settings, Depends(get_settings)]) -> DeliveryInfo:
    """Who receives the report email, so the tablet can show it before sending."""
    return DeliveryInfo(
        recipients=settings.report_recipients,
        email_enabled=bool(settings.smtp_host and settings.report_recipients),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def send_report(
    report: InventoryReport, settings: Annotated[Settings, Depends(get_settings)]
) -> ReportResult:
    """Turns a filled-in form into an A4 PDF + CSV and emails both to the office.

    The tablet retries reports that could not be sent (offline). If the first attempt did get
    through but the answer was lost, the retry has the same report_id and is not sent twice.
    """
    done_marker = (
        settings.outbox_dir / "sent_ids" / f"{report.report_id}.json" if report.report_id else None
    )
    if done_marker and done_marker.exists():
        return ReportResult.model_validate_json(done_marker.read_text(encoding="utf-8"))

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
    if done_marker:
        done_marker.parent.mkdir(parents=True, exist_ok=True)
        done_marker.write_text(result.model_dump_json(), encoding="utf-8")
    return result
