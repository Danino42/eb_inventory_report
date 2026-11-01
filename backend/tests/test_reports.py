import csv
import io
import re
from email import message_from_bytes, policy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import app


@pytest.fixture
def outbox(tmp_path: Path):
    """Reports go to a temporary outbox and are never really emailed."""
    settings = Settings(report_recipients=["office@example.com"], smtp_host="", outbox_dir=tmp_path)
    app.dependency_overrides[get_settings] = lambda: settings
    yield tmp_path
    app.dependency_overrides.clear()


client = TestClient(app)


def line(dev_name, name_de, variant, quantity, unit="kg", article="1010", custom=False):
    return {
        "article_number": article,
        "dev_name": dev_name,
        "name_de": name_de,
        "unit": unit,
        "variant": variant,
        "quantity": quantity,
        "custom": custom,
    }


REPORT = {
    "report_date": "2026-11-02",
    "worker": "Daniel",
    "lines": [
        line("apple_gala", "Apfel Gala", "conventional", 12),
        line("apple_gala", "Apfel Gala", "bio", None),
        line("lemon", "Zitrone", "bio", 11, unit="pcs", article="2010"),
        line("custom_1", "Saftorangen", "conventional", 2.5, article="", custom=True),
    ],
    "ifco": {"returned": 14, "enough_clean": True, "reorder_small": True, "reorder_large": False},
    "hq_notes": "Bananen-Lieferung unvollständig",
}


def pdf_page_count(pdf: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page(?!s)", pdf))


def test_report_creates_pdf_csv_and_email(outbox: Path) -> None:
    response = client.post("/api/reports", json=REPORT)
    assert response.status_code == 201
    result = response.json()
    assert result["delivery"] == "saved"  # no SMTP configured
    assert result["subject"] == "Warenbestände Nov 2 Montag"
    assert result["recipients"] == ["office@example.com"]
    assert len(result["files"]) == 3
    for name in result["files"]:
        assert (outbox / name).exists()

    eml = next(outbox.glob("*.eml")).read_bytes()
    msg = message_from_bytes(eml, policy=policy.default)
    assert msg["To"] == "office@example.com"
    attachments = [part.get_filename() for part in msg.iter_attachments()]
    assert attachments == [
        "Warenbestand_2026-11-02_Montag.pdf",
        "Warenbestand_2026-11-02_Montag.csv",
    ]
    body = msg.get_body(preferencelist=("plain",)).get_content()
    assert "Montag, 2. November 2026, erfasst von Daniel" in body
    assert "3 von 4 Feldern ausgefüllt (1 leer" in body


def test_pdf_is_one_a4_page_even_for_long_lists(outbox: Path) -> None:
    many = [
        line(f"fruit_{i}", f"Frucht {i}", v, i) for i in range(45) for v in ("conventional", "bio")
    ]
    client.post("/api/reports", json={**REPORT, "lines": many})
    pdf = next(outbox.glob("*.pdf")).read_bytes()
    assert pdf.startswith(b"%PDF")
    assert pdf_page_count(pdf) == 1
    assert b"/MediaBox [ 0 0 595.2756 841.8898 ]" in pdf  # A4


def test_pdf_contains_fruit_and_ifco_icons(outbox: Path) -> None:
    client.post("/api/reports", json=REPORT)
    pdf = next(outbox.glob("*.pdf")).read_bytes()
    # Apfel Gala, Zitrone and the IFCO crate have icons; the hand-typed Saftorangen has none
    assert len(re.findall(rb"/Subtype\s*/Image", pdf)) >= 3


def test_csv_has_one_row_per_field(outbox: Path) -> None:
    client.post("/api/reports", json=REPORT)
    raw = next(outbox.glob("*.csv")).read_bytes()
    assert raw.startswith(b"\xef\xbb\xbf")  # BOM, so Excel shows umlauts correctly
    rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig")), delimiter=";"))
    assert len(rows) == 4
    assert rows[0]["report_date"] == "2026-11-02" and rows[0]["quantity"] == "12"
    assert rows[1]["quantity"] == ""  # empty field stays empty
    assert rows[3]["quantity"] == "2.5" and rows[3]["custom"] == "1"


def test_resent_report_is_not_emailed_twice(outbox: Path) -> None:
    report = {**REPORT, "report_id": "3f1c2b7e-0d4a-4c1e-9b7a-2a6f0c9d1e55"}
    first = client.post("/api/reports", json=report).json()
    again = client.post("/api/reports", json=report).json()
    assert again == first
    assert len(list(outbox.glob("*.eml"))) == 1
    # A different report id is a different report
    client.post("/api/reports", json={**report, "report_id": "another-report-0001"})
    assert len(list(outbox.glob("*.eml"))) == 2


def test_delivery_info_shows_recipients(outbox: Path) -> None:
    info = client.get("/api/reports/delivery").json()
    # The test settings have recipients but no SMTP server: saved only, not emailed
    assert info == {"recipients": ["office@example.com"], "email_enabled": False}


def test_invalid_reports_are_rejected(outbox: Path) -> None:
    negative = {**REPORT, "lines": [line("banana", "Banane", "bio", -1)]}
    assert client.post("/api/reports", json=negative).status_code == 422
    assert client.post("/api/reports", json={**REPORT, "worker": ""}).status_code == 422
    bad_id = {**REPORT, "report_id": "../../etc/passwd"}
    assert client.post("/api/reports", json=bad_id).status_code == 422
