"""Remembers sent reports, so a report the tablet sends again (same report_id, e.g. because the
answer to the first try got lost) is not emailed twice. With MongoDB it is also the lasting
history of all reports: the whole form plus where it went."""

from datetime import datetime
from pathlib import Path
from typing import Protocol

from pymongo.collection import Collection

from app.models.report import InventoryReport, ReportResult


class ReportLog(Protocol):
    def find(self, report_id: str) -> ReportResult | None: ...

    def add(self, report: InventoryReport, result: ReportResult, sent_at: datetime) -> None: ...


class FileReportLog:
    """Without a database: one small file per report id (the report itself is in the outbox)."""

    def __init__(self, folder: Path) -> None:
        self.folder = folder

    def find(self, report_id: str) -> ReportResult | None:
        path = self.folder / f"{report_id}.json"
        if not path.exists():
            return None
        return ReportResult.model_validate_json(path.read_text(encoding="utf-8"))

    def add(self, report: InventoryReport, result: ReportResult, sent_at: datetime) -> None:
        if not report.report_id:
            return
        self.folder.mkdir(parents=True, exist_ok=True)
        path = self.folder / f"{report.report_id}.json"
        path.write_text(result.model_dump_json(), encoding="utf-8")


class MongoReportLog:
    """With MongoDB: one document per report in the "reports" collection, kept for good."""

    def __init__(self, collection: Collection) -> None:
        self.collection = collection

    def find(self, report_id: str) -> ReportResult | None:
        doc = self.collection.find_one({"_id": report_id}, {"result": True})
        return ReportResult.model_validate(doc["result"]) if doc else None

    def add(self, report: InventoryReport, result: ReportResult, sent_at: datetime) -> None:
        doc = {
            **report.model_dump(mode="json", exclude={"report_id"}),
            "result": result.model_dump(mode="json"),
            "sent_at": sent_at,
        }
        if report.report_id:
            # The report id is the document id, so a resend never adds a second copy
            self.collection.replace_one({"_id": report.report_id}, doc, upsert=True)
        else:
            self.collection.insert_one(doc)
