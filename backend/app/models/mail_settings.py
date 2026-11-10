from pydantic import BaseModel, EmailStr, Field, field_validator


class MailSettings(BaseModel):
    """Who gets the report emails, and from which address; set on the Verwaltung settings page."""

    # While use_production is off, reports only go to these addresses (testing)
    test_recipients: list[EmailStr] = Field(default_factory=list, max_length=10)
    # The real addresses, e.g. the office at HQ
    production_recipients: list[EmailStr] = Field(default_factory=list, max_length=10)
    use_production: bool = False
    # Sender address (with Brevo: verified there). None: SMTP_FROM of the server
    sender: EmailStr | None = None

    @field_validator("test_recipients", "production_recipients")
    @classmethod
    def _without_duplicates(cls, addresses: list[str]) -> list[str]:
        return list(dict.fromkeys(addresses))

    @property
    def recipients(self) -> list[str]:
        """Where reports go right now"""
        return list(self.production_recipients if self.use_production else self.test_recipients)


class MailSettingsInfo(MailSettings):
    """What the settings page shows: the settings, plus what the server is set up with"""

    email_configured: bool
    # Sender used when the page has none (SMTP_FROM on the server)
    server_sender: str


class TestMailResult(BaseModel):
    sender: str
    recipients: list[str]
