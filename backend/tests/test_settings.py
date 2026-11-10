import base64
import io
import json
import urllib.error
import urllib.request
from email import message_from_bytes, policy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_mail_settings_store
from app.core.config import Settings, get_settings
from app.main import app
from app.services import mailer
from app.services.mail_settings_store import MongoMailSettingsStore
from tests.test_reports import REPORT

client = TestClient(app)


@pytest.fixture
def config(tmp_path: Path):
    """Test addresses only; nothing is really sent, nothing touches the local settings file."""
    settings = Settings(
        _env_file=None,
        report_recipients=["dev@example.com"],
        production_recipients=["office@example.com"],
        smtp_host="",
        brevo_api_key="",
        mongodb_uri="",
        outbox_dir=tmp_path / "outbox",
        mail_settings_file=tmp_path / "mail_settings.json",
    )
    app.dependency_overrides[get_settings] = lambda: settings
    yield settings
    app.dependency_overrides.clear()


def pin(settings: Settings) -> dict[str, str]:
    return {"X-Admin-Pin": settings.admin_pin}


def recipients_shown_before_sending() -> list[str]:
    return client.get("/api/reports/delivery").json()["recipients"]


def test_settings_need_the_pin(config: Settings) -> None:
    assert client.get("/api/settings/mail").status_code == 401
    assert client.put("/api/settings/mail", json={"test_recipients": []}).status_code == 401


def test_starting_values_come_from_the_server(config: Settings) -> None:
    assert client.get("/api/settings/mail", headers=pin(config)).json() == {
        "test_recipients": ["dev@example.com"],
        "production_recipients": ["office@example.com"],
        "use_production": False,
        "sender": None,
        "email_configured": False,
        "server_sender": "noreply@earlybird.local",
    }
    assert recipients_shown_before_sending() == ["dev@example.com"]


def test_production_switch_decides_where_reports_go(config: Settings) -> None:
    production = {
        "test_recipients": ["dev@example.com"],
        "production_recipients": ["office@example.com", "boss@example.com"],
        "use_production": True,
    }
    assert client.put("/api/settings/mail", json=production, headers=pin(config)).status_code == 200
    assert recipients_shown_before_sending() == ["office@example.com", "boss@example.com"]

    result = client.post("/api/reports", json=REPORT).json()
    assert result["recipients"] == ["office@example.com", "boss@example.com"]
    eml = next((config.outbox_dir).glob("*.eml")).read_bytes()
    assert (
        message_from_bytes(eml, policy=policy.default)["To"]
        == "office@example.com, boss@example.com"
    )

    testing = {**production, "use_production": False}
    client.put("/api/settings/mail", json=testing, headers=pin(config))
    assert recipients_shown_before_sending() == ["dev@example.com"]


def test_invalid_settings_are_rejected(config: Settings) -> None:
    bad_address = {"test_recipients": ["not-an-address"], "production_recipients": []}
    assert (
        client.put("/api/settings/mail", json=bad_address, headers=pin(config)).status_code == 422
    )
    # Production switched on without a production address: reports would go nowhere
    empty = {
        "test_recipients": ["dev@example.com"],
        "production_recipients": [],
        "use_production": True,
    }
    assert client.put("/api/settings/mail", json=empty, headers=pin(config)).status_code == 422
    assert recipients_shown_before_sending() == ["dev@example.com"]  # nothing was saved


def test_settings_are_kept_in_mongodb(config: Settings, mongo_db) -> None:
    app.dependency_overrides[get_mail_settings_store] = lambda: MongoMailSettingsStore(
        mongo_db["settings"]
    )
    saved = {
        "test_recipients": ["dev@example.com"],
        "production_recipients": [],
        "use_production": False,
    }
    client.put("/api/settings/mail", json=saved, headers=pin(config))
    assert mongo_db["settings"].find_one({"_id": "mail"}, {"_id": False}) == {
        **saved,
        "sender": None,
    }


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args) -> None:
        pass


def test_brevo_sends_the_report_over_https(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "test-key"
    config.smtp_from = "Earlybird Warenbestand <reports@example.com>"
    sent: list[urllib.request.Request] = []

    def fake_urlopen(request, timeout):
        sent.append(request)
        return FakeResponse(b'{"messageId": "<1@brevo>"}')

    monkeypatch.setattr(mailer.urllib.request, "urlopen", fake_urlopen)
    result = client.post("/api/reports", json=REPORT).json()
    assert result["delivery"] == "sent"

    (request,) = sent
    assert request.full_url == mailer.BREVO_URL
    assert request.get_header("Api-key") == "test-key"
    payload = json.loads(request.data)
    assert payload["sender"] == {"name": "Earlybird Warenbestand", "email": "reports@example.com"}
    assert payload["to"] == [{"email": "dev@example.com"}]
    assert payload["subject"] == "Warenbestände Nov 2 Montag"
    pdf, csv = payload["attachment"]
    assert pdf["name"].endswith(".pdf") and base64.b64decode(pdf["content"]).startswith(b"%PDF")
    assert csv["name"].endswith(".csv")


def brevo_refuses(message: str):
    """Fake urlopen: Brevo answers with an error like the real API (JSON code + message)"""

    def urlopen(request, timeout):
        body = json.dumps({"code": "unauthorized", "message": message}).encode()
        raise urllib.error.HTTPError(request.full_url, 401, "Unauthorized", None, io.BytesIO(body))

    return urlopen


def test_brevo_error_keeps_the_report_on_the_tablet(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "wrong-key"
    monkeypatch.setattr(mailer.urllib.request, "urlopen", brevo_refuses("Key not found"))
    # 5xx: the tablet keeps the report and tries again later
    assert client.post("/api/reports", json=REPORT).status_code == 502


def test_sender_from_the_settings_page(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "test-key"
    sent: list[urllib.request.Request] = []
    monkeypatch.setattr(
        mailer.urllib.request, "urlopen", lambda r, timeout: sent.append(r) or FakeResponse(b"{}")
    )
    settings = {
        "test_recipients": ["dev@example.com"],
        "production_recipients": [],
        "sender": "earlybird.inventory@example.com",
    }
    client.put("/api/settings/mail", json=settings, headers=pin(config))
    client.post("/api/reports", json=REPORT)
    sender = json.loads(sent[0].data)["sender"]
    assert sender == {"name": "Earlybird Warenbestand", "email": "earlybird.inventory@example.com"}


TEST_MAIL = {
    "test_recipients": ["dev@example.com"],
    "production_recipients": [],
    "sender": "earlybird.inventory@example.com",
}


def test_test_email_uses_the_values_on_the_page(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "test-key"
    sent: list[urllib.request.Request] = []
    monkeypatch.setattr(
        mailer.urllib.request, "urlopen", lambda r, timeout: sent.append(r) or FakeResponse(b"{}")
    )
    response = client.post("/api/settings/mail/test", json=TEST_MAIL, headers=pin(config))
    assert response.status_code == 200
    assert response.json() == {
        "sender": "Earlybird Warenbestand <earlybird.inventory@example.com>",
        "recipients": ["dev@example.com"],
    }
    payload = json.loads(sent[0].data)
    assert payload["to"] == [{"email": "dev@example.com"}]
    assert "attachment" not in payload
    # Testing does not save anything
    assert client.get("/api/settings/mail", headers=pin(config)).json()["sender"] is None


def test_test_email_shows_why_brevo_refused(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "test-key"
    reason = "We have detected you are using an unrecognised IP address 203.0.113.7"
    monkeypatch.setattr(mailer.urllib.request, "urlopen", brevo_refuses(reason))
    response = client.post("/api/settings/mail/test", json=TEST_MAIL, headers=pin(config))
    assert response.status_code == 502
    assert response.json()["detail"] == f"Brevo 401: {reason}"


def test_test_email_needs_a_way_of_sending(config: Settings) -> None:
    assert client.post("/api/settings/mail/test", json=TEST_MAIL).status_code == 401
    response = client.post("/api/settings/mail/test", json=TEST_MAIL, headers=pin(config))
    assert response.status_code == 409
