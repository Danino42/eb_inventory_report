from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

MAX_RECIPIENTS = 10


def _without_duplicates(addresses: list[str]) -> list[str]:
    return list(dict.fromkeys(addresses))


class MailSettings(BaseModel):
    """Who gets the report emails (Verwaltung -> Einstellungen) and the fixed sender."""

    recipients: list[EmailStr] = Field(default_factory=list, max_length=MAX_RECIPIENTS)
    # Fixed sender (verified in Brevo), not editable on the page. None: SMTP_FROM of the server
    sender: EmailStr | None = None

    @model_validator(mode="before")
    @classmethod
    def _from_older_version(cls, data: Any) -> Any:
        """Settings saved with the former test/production switch: keep the list that was in use"""
        if isinstance(data, dict) and "recipients" not in data and "test_recipients" in data:
            in_use = "production_recipients" if data.get("use_production") else "test_recipients"
            return {"recipients": data.get(in_use) or [], "sender": data.get("sender")}
        return data

    _unique = field_validator("recipients")(_without_duplicates)


class RecipientsUpdate(BaseModel):
    """What the page can change: only the recipients"""

    recipients: list[EmailStr] = Field(min_length=1, max_length=MAX_RECIPIENTS)

    _unique = field_validator("recipients")(_without_duplicates)


class MailSettingsInfo(BaseModel):
    """What the settings page shows"""

    recipients: list[str]
    # The address the emails come from (fixed)
    sender: str
    # False: the server has no way of sending yet (Brevo / SMTP), reports are only saved
    email_configured: bool


class TestMailResult(BaseModel):
    sender: str
    recipients: list[str]
