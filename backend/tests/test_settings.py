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
from app.models.mail_settings import MailSettings
from app.services import mailer
from app.services.mail_settings_store import FileMailSettingsStore, MongoMailSettingsStore
from tests.test_reports import REPORT

client = TestClient(app)
SENDER = "earlybird.inventory@example.com"


@pytest.fixture
def config(tmp_path: Path):
    """Test addresses only; nothing is really sent, nothing touches the local settings file."""
    settings = Settings(
        _env_file=None,
        report_recipients=["dev@example.com"],
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


def shown_before_sending() -> list[str]:
    return client.get("/api/reports/delivery").json()["recipients"]


def save_sender(settings: Settings) -> None:
    """The sender as saved by the earlier version of the page (now fixed)"""
    FileMailSettingsStore(settings.mail_settings_file).save(
        MailSettings(recipients=["dev@example.com"], sender=SENDER)
    )


def test_settings_need_the_pin(config: Settings) -> None:
    assert client.get("/api/settings/mail").status_code == 401
    one = {"recipients": ["a@example.com"]}
    assert client.put("/api/settings/mail", json=one).status_code == 401


def test_starting_values_come_from_the_server(config: Settings) -> None:
    assert client.get("/api/settings/mail", headers=pin(config)).json() == {
        "recipients": ["dev@example.com"],
        "sender": "noreply@earlybird.local",
        "email_configured": False,
    }
    assert shown_before_sending() == ["dev@example.com"]


def test_several_recipients(config: Settings) -> None:
    several = {"recipients": ["office@example.com", "boss@example.com", "office@example.com"]}
    response = client.put("/api/settings/mail", json=several, headers=pin(config))
    assert response.json()["recipients"] == ["office@example.com", "boss@example.com"]
    assert shown_before_sending() == ["office@example.com", "boss@example.com"]

    result = client.post("/api/reports", json=REPORT).json()
    assert result["recipients"] == ["office@example.com", "boss@example.com"]
    eml = next(config.outbox_dir.glob("*.eml")).read_bytes()
    to = message_from_bytes(eml, policy=policy.default)["To"]
    assert to == "office@example.com, boss@example.com"


def test_invalid_recipients_are_rejected(config: Settings) -> None:
    for bad in ({"recipients": ["not-an-address"]}, {"recipients": []}):
        assert client.put("/api/settings/mail", json=bad, headers=pin(config)).status_code == 422
    assert shown_before_sending() == ["dev@example.com"]  # nothing was saved


def test_sender_is_fixed(config: Settings) -> None:
    save_sender(config)
    attempt = {"recipients": ["office@example.com"], "sender": "someone.else@example.com"}
    response = client.put("/api/settings/mail", json=attempt, headers=pin(config))
    assert response.json()["sender"] == SENDER
    assert FileMailSettingsStore(config.mail_settings_file).load().sender == SENDER


def test_settings_of_the_former_test_production_switch_are_kept(config: Settings, mongo_db) -> None:
    mongo_db["settings"].insert_one(
        {
            "_id": "mail",
            "test_recipients": ["dev@example.com"],
            "production_recipients": ["office@example.com"],
            "use_production": False,
            "sender": SENDER,
        }
    )
    app.dependency_overrides[get_mail_settings_store] = lambda: MongoMailSettingsStore(
        mongo_db["settings"]
    )
    # The list that was in use (test) becomes the recipients, so nobody new gets emails
    assert client.get("/api/settings/mail", headers=pin(config)).json() == {
        "recipients": ["dev@example.com"],
        "sender": SENDER,
        "email_configured": False,
    }
    client.put(
        "/api/settings/mail", json={"recipients": ["office@example.com"]}, headers=pin(config)
    )
    saved = mongo_db["settings"].find_one({"_id": "mail"}, {"_id": False})
    assert saved == {"recipients": ["office@example.com"], "sender": SENDER}


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args) -> None:
        pass


def capture_brevo(monkeypatch) -> list[urllib.request.Request]:
    sent: list[urllib.request.Request] = []

    def fake_urlopen(request, timeout):
        sent.append(request)
        return FakeResponse(b'{"messageId": "<1@brevo>"}')

    monkeypatch.setattr(mailer.urllib.request, "urlopen", fake_urlopen)
    return sent


def brevo_refuses(message: str):
    """Fake urlopen: Brevo answers with an error like the real API (JSON code + message)"""

    def urlopen(request, timeout):
        body = json.dumps({"code": "unauthorized", "message": message}).encode()
        raise urllib.error.HTTPError(request.full_url, 401, "Unauthorized", None, io.BytesIO(body))

    return urlopen


def test_brevo_sends_the_report_from_the_fixed_sender(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "test-key"
    save_sender(config)
    sent = capture_brevo(monkeypatch)
    assert client.post("/api/reports", json=REPORT).json()["delivery"] == "sent"

    (request,) = sent
    assert request.full_url == mailer.BREVO_URL
    assert request.get_header("Api-key") == "test-key"
    payload = json.loads(request.data)
    assert payload["sender"] == {"name": "Earlybird Warenbestand", "email": SENDER}
    assert payload["to"] == [{"email": "dev@example.com"}]
    assert payload["subject"] == "Warenbestände Nov 2 Montag"
    pdf, csv = payload["attachment"]
    assert pdf["name"].endswith(".pdf") and base64.b64decode(pdf["content"]).startswith(b"%PDF")
    assert csv["name"].endswith(".csv")


def test_brevo_error_keeps_the_report_on_the_tablet(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "wrong-key"
    monkeypatch.setattr(mailer.urllib.request, "urlopen", brevo_refuses("Key not found"))
    # 5xx: the tablet keeps the report and tries again later
    assert client.post("/api/reports", json=REPORT).status_code == 502


def test_test_email_goes_to_the_addresses_on_the_page(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "test-key"
    save_sender(config)
    sent = capture_brevo(monkeypatch)
    on_page = {"recipients": ["office@example.com", "boss@example.com"]}
    response = client.post("/api/settings/mail/test", json=on_page, headers=pin(config))
    assert response.status_code == 200
    assert response.json() == {
        "sender": f"Earlybird Warenbestand <{SENDER}>",
        "recipients": ["office@example.com", "boss@example.com"],
    }
    payload = json.loads(sent[0].data)
    assert payload["to"] == [{"email": "office@example.com"}, {"email": "boss@example.com"}]
    assert "attachment" not in payload
    # Testing does not save anything
    saved = client.get("/api/settings/mail", headers=pin(config)).json()
    assert saved["recipients"] == ["dev@example.com"]


def test_test_email_shows_why_brevo_refused(config: Settings, monkeypatch) -> None:
    config.brevo_api_key = "test-key"
    reason = "We have detected you are using an unrecognised IP address 203.0.113.7"
    monkeypatch.setattr(mailer.urllib.request, "urlopen", brevo_refuses(reason))
    on_page = {"recipients": ["dev@example.com"]}
    response = client.post("/api/settings/mail/test", json=on_page, headers=pin(config))
    assert response.status_code == 502
    assert response.json()["detail"] == f"Brevo 401: {reason}"


def test_test_email_needs_a_way_of_sending(config: Settings) -> None:
    on_page = {"recipients": ["dev@example.com"]}
    assert client.post("/api/settings/mail/test", json=on_page).status_code == 401
    response = client.post("/api/settings/mail/test", json=on_page, headers=pin(config))
    assert response.status_code == 409
