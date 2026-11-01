from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.models.fruit import Unit, Variant


class StockLine(BaseModel):
    """One amount field of the form: a fruit in one variant (Konventionell or Bio)."""

    article_number: str = Field(default="", max_length=20)
    # Catalogue dev name, or "custom_…" for fruits typed in by hand
    dev_name: str = Field(max_length=60)
    name_de: str = Field(min_length=1, max_length=80)
    unit: Unit
    variant: Variant
    # None = field left empty (not counted)
    quantity: float | None = Field(default=None, ge=0)
    custom: bool = False


class IfcoReport(BaseModel):
    """Monday-only IFCO check."""

    returned: int | None = Field(default=None, ge=0)
    enough_clean: bool | None = None
    reorder_small: bool = False
    reorder_large: bool = False


class InventoryReport(BaseModel):
    """What the worker form sends: the digital "Warenbestände Lebensmittel" sheet."""

    report_date: date
    worker: str = Field(min_length=1, max_length=80)
    lines: list[StockLine] = Field(max_length=300)
    ifco: IfcoReport | None = None
    hq_notes: str = Field(default="", max_length=1000)


class ReportResult(BaseModel):
    # "sent" = emailed via SMTP, "saved" = SMTP not configured, email only saved to the outbox
    delivery: Literal["sent", "saved"]
    recipients: list[str]
    subject: str
    files: list[str]
