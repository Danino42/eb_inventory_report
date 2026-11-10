import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.main import app

client = TestClient(app)


def test_pin_check_unlocks_the_verwaltung() -> None:
    right = {"X-Admin-Pin": get_settings().admin_pin}
    assert client.post("/api/admin/pin", headers=right).status_code == 204
    response = client.post("/api/admin/pin", headers={"X-Admin-Pin": "0000x"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong PIN"}
    assert client.post("/api/admin/pin").status_code == 401


def test_pin_is_7777_unless_set_on_the_server(monkeypatch) -> None:
    monkeypatch.delenv("ADMIN_PIN", raising=False)
    assert Settings(_env_file=None).admin_pin == "7777"
    monkeypatch.setenv("ADMIN_PIN", "4321")
    assert Settings(_env_file=None).admin_pin == "4321"
    # The tablet's keypad takes exactly 4 digits
    monkeypatch.setenv("ADMIN_PIN", "12345")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
