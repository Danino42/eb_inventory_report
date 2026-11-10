from pydantic import BaseModel, EmailStr, Field, field_validator


class MailSettings(BaseModel):
    """Who gets the report emails; set on the Verwaltung settings page."""

    # While use_production is off, reports only go to these addresses (testing)
    test_recipients: list[EmailStr] = Field(default_factory=list, max_length=10)
    # The real addresses, e.g. the office at HQ
    production_recipients: list[EmailStr] = Field(default_factory=list, max_length=10)
    use_production: bool = False

    @field_validator("test_recipients", "production_recipients")
    @classmethod
    def _without_duplicates(cls, addresses: list[str]) -> list[str]:
        return list(dict.fromkeys(addresses))

    @property
    def recipients(self) -> list[str]:
        """Where reports go right now"""
        return list(self.production_recipients if self.use_production else self.test_recipients)


class MailSettingsInfo(MailSettings):
    """What the settings page shows: the settings, plus whether the server can send at all"""

    email_configured: bool
