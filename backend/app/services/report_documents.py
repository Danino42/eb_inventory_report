"""Builds the PDF, CSV and email text for an inventory report."""

import csv
import io
from datetime import date, datetime
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepInFrame,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.report import InventoryReport, StockLine

WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
MONTHS = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]  # fmt: skip
MONTHS_SHORT = [
    "Jan",
    "Feb",
    "März",
    "Apr",
    "Mai",
    "Juni",
    "Juli",
    "Aug",
    "Sept",
    "Okt",
    "Nov",
    "Dez",
]
UNIT_LABEL = {"kg": "kg", "pcs": "Stk"}

# Same subtle orange as the tablet overview: "field left empty"
EMPTY_FILL = colors.HexColor("#FFF1DF")
EMPTY_TEXT = colors.HexColor("#B4691F")
GRID = colors.HexColor("#D9D9D9")
HEADER_FILL = colors.HexColor("#F3F3F3")

MARGIN = 16 * mm
# Usable width: page minus margins minus the 6 pt inner padding ReportLab's frame adds per side
CONTENT_WIDTH = A4[0] - 2 * MARGIN - 12


def col_widths(*shares: float) -> list[float]:
    """Column widths as shares of the content width, so every table lines up with the text."""
    total = sum(shares)
    return [CONTENT_WIDTH * share / total for share in shares]


ICON_SIZE = 6 * mm


def icon(path: Path, size: float = ICON_SIZE, align: str = "CENTER") -> Image | str:
    """The picture if it exists, otherwise an empty cell (e.g. hand-typed fruits)"""
    if not path.is_file():
        return ""
    image = Image(str(path), width=size, height=size, mask="auto")
    image.hAlign = align
    return image


def long_date(d: date) -> str:
    """ "Montag, 2. November 2026" """
    return f"{WEEKDAYS[d.weekday()]}, {d.day}. {MONTHS[d.month - 1]} {d.year}"


def email_subject(report: InventoryReport) -> str:
    """ "Warenbestände Nov 2 Montag" """
    d = report.report_date
    return f"Warenbestände {MONTHS_SHORT[d.month - 1]} {d.day} {WEEKDAYS[d.weekday()]}"


def file_stem(report: InventoryReport) -> str:
    """ "Warenbestand_2026-11-02_Montag" """
    return f"Warenbestand_{report.report_date.isoformat()}_{WEEKDAYS[report.report_date.weekday()]}"


def format_quantity(q: float) -> str:
    """Swiss style for people: decimal comma, no trailing zeros"""
    return f"{q:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def grouped_lines(report: InventoryReport) -> list[tuple[StockLine, dict[str, StockLine]]]:
    """One entry per fruit (form order), with its lines per variant."""
    groups: dict[str, tuple[StockLine, dict[str, StockLine]]] = {}
    for line in report.lines:
        first, by_variant = groups.setdefault(line.dev_name, (line, {}))
        by_variant[line.variant] = line
    return list(groups.values())


def empty_count(report: InventoryReport) -> int:
    return sum(1 for line in report.lines if line.quantity is None)


# --- PDF -------------------------------------------------------------------------------------


def build_pdf(report: InventoryReport, created_at: datetime, images_dir: Path) -> bytes:
    """One A4 page: header, fruit table with icons (empty fields in soft orange), IFCO, notes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=email_subject(report),
        author="Earlybird Warenbestand-App",
    )
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=9.5, leading=12)
    title = ParagraphStyle("title", parent=base, fontName="Helvetica-Bold", fontSize=16, leading=20)
    heading = ParagraphStyle("heading", parent=base, fontName="Helvetica-Bold", fontSize=11)

    story: list = [
        Paragraph("Warenbestände Lebensmittel", title),
        Spacer(1, 2 * mm),
        Table(
            [
                [
                    Paragraph(f"<b>Datum</b><br/>{escape(long_date(report.report_date))}", base),
                    Paragraph(f"<b>Name</b><br/>{escape(report.worker)}", base),
                    Paragraph(f"<b>Erstellt</b><br/>{created_at:%d.%m.%Y %H:%M}", base),
                ]
            ],
            colWidths=col_widths(70, 60, 48),
            style=TableStyle(
                [("LEFTPADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "TOP")]
            ),
        ),
        Spacer(1, 5 * mm),
        _fruit_table(report, base, images_dir / "fruit_icons"),
    ]

    if report.ifco is not None:
        story += [
            Spacer(1, 5 * mm),
            Table(
                [[icon(images_dir / "ifco.png", 8 * mm, align="LEFT"), Paragraph("IFCO", heading)]],
                colWidths=[10 * mm, CONTENT_WIDTH - 10 * mm],
                style=TableStyle(
                    [("PADDING", (0, 0), (-1, -1), 0), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
                ),
            ),
            Spacer(1, 1.5 * mm),
            _ifco_table(report),
        ]

    story += [Spacer(1, 5 * mm), Paragraph("Infos für HQ", heading), Spacer(1, 1.5 * mm)]
    notes = escape(report.hq_notes).replace("\n", "<br/>") if report.hq_notes.strip() else "–"
    story.append(
        Table(
            [[Paragraph(notes, base)]],
            colWidths=[CONTENT_WIDTH],
            style=TableStyle(
                [("BOX", (0, 0), (-1, -1), 0.6, GRID), ("PADDING", (0, 0), (-1, -1), 6)]
            ),
        )
    )

    # Shrinks everything a little if a long list would not fit: the report is always one page
    frame_height = A4[1] - doc.topMargin - doc.bottomMargin
    doc.build([KeepInFrame(doc.width, frame_height, story, mode="shrink")])
    return buffer.getvalue()


def _fruit_table(report: InventoryReport, base: ParagraphStyle, icons_dir: Path) -> Table:
    # Columns: Art.-Nr. | icon | Frucht | Konventionell | Bio | Einheit ("Frucht" spans icon + name)
    rows: list[list] = [["Art.-Nr.", "Frucht", "", "Konventionell", "Bio", "Einheit"]]
    style = [
        ("SPAN", (1, 0), (2, 0)),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_FILL),
        # Grid without a line between icon and name
        ("BOX", (0, 0), (-1, -1), 0.5, GRID),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, GRID),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, GRID),
        ("LINEAFTER", (2, 0), (4, -1), 0.5, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (3, 0), (4, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (1, 1), (1, -1), 0),
    ]
    for r, (first, by_variant) in enumerate(grouped_lines(report), start=1):
        name = escape(first.name_de)
        if first.custom:
            name += ' <font size="8" color="#8A8A8A">(eigene Eingabe)</font>'
        row = [
            first.article_number or "–",
            icon(icons_dir / f"{first.dev_name}.png"),
            Paragraph(name, base),
        ]
        for c, variant in ((3, "conventional"), (4, "bio")):
            line = by_variant.get(variant)
            if line is None:
                row.append("")  # variant does not exist for this fruit
                style.append(("BACKGROUND", (c, r), (c, r), HEADER_FILL))
            elif line.quantity is None:
                row.append("leer")
                style += [
                    ("BACKGROUND", (c, r), (c, r), EMPTY_FILL),
                    ("TEXTCOLOR", (c, r), (c, r), EMPTY_TEXT),
                    ("FONTSIZE", (c, r), (c, r), 8),
                ]
            else:
                row.append(format_quantity(line.quantity))
        row.append(UNIT_LABEL[first.unit])
        rows.append(row)
    return Table(
        rows,
        colWidths=col_widths(18, 9, 73, 30, 30, 18),
        repeatRows=1,
        style=TableStyle(style),
    )


def _ifco_table(report: InventoryReport) -> Table:
    ifco = report.ifco
    assert ifco is not None
    reorder = [
        label
        for flag, label in ((ifco.reorder_small, "IFCO klein"), (ifco.reorder_large, "IFCO gross"))
        if flag
    ]
    values = [
        ("IFCOs zurück erhalten", None if ifco.returned is None else f"{ifco.returned} Stk"),
        (
            "Genügend saubere IFCOs (mind. 1 Stoss gross, 2 Stoss klein)",
            None if ifco.enough_clean is None else ("Ja" if ifco.enough_clean else "Nein"),
        ),
        ("Nachbestellen", ", ".join(reorder) if reorder else "nichts"),
    ]
    style = [
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    rows = []
    for r, (label, value) in enumerate(values):
        if value is None:
            rows.append([label, "leer"])
            style += [
                ("BACKGROUND", (1, r), (1, r), EMPTY_FILL),
                ("TEXTCOLOR", (1, r), (1, r), EMPTY_TEXT),
            ]
        else:
            rows.append([label, value])
    return Table(rows, colWidths=col_widths(118, 60), style=TableStyle(style))


# --- CSV -------------------------------------------------------------------------------------

CSV_COLUMNS = [
    "report_date",
    "weekday",
    "worker",
    "article_number",
    "dev_name",
    "name_de",
    "variant",
    "quantity",
    "unit",
    "custom",
]


def build_csv(report: InventoryReport) -> bytes:
    """One row per amount field, for the later automatic import.

    Semicolon-separated, UTF-8 with BOM (opens correctly in Excel), ISO date, decimal point,
    empty quantity = field left empty.
    """
    out = io.StringIO()
    writer = csv.writer(out, delimiter=";", lineterminator="\r\n")
    writer.writerow(CSV_COLUMNS)
    weekday = WEEKDAYS[report.report_date.weekday()]
    for line in report.lines:
        writer.writerow(
            [
                report.report_date.isoformat(),
                weekday,
                report.worker,
                line.article_number,
                line.dev_name,
                line.name_de,
                line.variant,
                "" if line.quantity is None else f"{line.quantity:g}",
                line.unit,
                "1" if line.custom else "0",
            ]
        )
    return out.getvalue().encode("utf-8-sig")


# --- Email text ------------------------------------------------------------------------------


def email_body(report: InventoryReport) -> str:
    empty = empty_count(report)
    day = long_date(report.report_date)
    lines = [
        "Hallo",
        "",
        f"Im Anhang der Warenbestand von {day}, erfasst von {report.worker}.",
        "",
        f"- {len(report.lines) - empty} von {len(report.lines)} Feldern ausgefüllt"
        + (f" ({empty} leer, im PDF orange markiert)" if empty else ""),
    ]
    if report.ifco is not None:
        ifco = report.ifco
        reorder = [
            n for f, n in ((ifco.reorder_small, "klein"), (ifco.reorder_large, "gross")) if f
        ]
        lines.append(
            "- IFCO: "
            + ("? zurück" if ifco.returned is None else f"{ifco.returned} zurück")
            + ", genügend sauber: "
            + {True: "Ja", False: "Nein", None: "?"}[ifco.enough_clean]
            + (f", nachbestellen: {' und '.join(reorder)}" if reorder else "")
        )
    if report.hq_notes.strip():
        lines += ["", "Infos für HQ:", report.hq_notes.strip()]
    lines += [
        "",
        "PDF zum Übertragen ins System, CSV für den späteren automatischen Import.",
        "",
        "Freundliche Grüsse",
        "Earlybird Warenbestand-App",
    ]
    return "\n".join(lines)
