"""The mail settings of the Verwaltung settings page: in MongoDB on the server, in a local JSON
file during development (data/mail_settings.local.json, not in git: it holds email addresses)."""

import os
from pathlib import Path
from typing import Protocol

from pymongo.collection import Collection

from app.core.config import Settings
from app.models.mail_settings import MailSettings


class MailSettingsStore(Protocol):
    def load(self) -> MailSettings | None: ...

    def save(self, mail: MailSettings) -> None: ...


class FileMailSettingsStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def load(self) -> MailSettings | None:
        if not self.path.exists():
            return None
        return MailSettings.model_validate_json(self.path.read_text(encoding="utf-8"))

    def save(self, mail: MailSettings) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(mail.model_dump_json(indent=2) + "\n", encoding="utf-8")
        os.replace(tmp, self.path)


class MongoMailSettingsStore:
    """One document in the "settings" collection"""

    DOC_ID = "mail"

    def __init__(self, collection: Collection) -> None:
        self.collection = collection

    def load(self) -> MailSettings | None:
        doc = self.collection.find_one({"_id": self.DOC_ID}, {"_id": False})
        return MailSettings.model_validate(doc) if doc else None

    def save(self, mail: MailSettings) -> None:
        self.collection.replace_one({"_id": self.DOC_ID}, mail.model_dump(mode="json"), upsert=True)


def current_mail_settings(store: MailSettingsStore, settings: Settings) -> MailSettings:
    """The saved settings; until the page is saved once, the starting values of the server"""
    return store.load() or MailSettings(
        test_recipients=settings.report_recipients,
        production_recipients=settings.production_recipients,
    )
