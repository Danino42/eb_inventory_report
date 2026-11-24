from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.services.database import get_database
from app.services.fruit_images import FileFruitImageStore, FruitImageStore, MongoFruitImageStore
from app.services.mail_settings_store import (
    FileMailSettingsStore,
    MailSettingsStore,
    MongoMailSettingsStore,
)


def get_mail_settings_store(
    settings: Annotated[Settings, Depends(get_settings)],
) -> MailSettingsStore:
    # MongoDB on the server, a local file (not in git) during development
    if settings.mongodb_uri:
        return MongoMailSettingsStore(get_database()["settings"])
    return FileMailSettingsStore(settings.mail_settings_file)


MailStore = Annotated[MailSettingsStore, Depends(get_mail_settings_store)]


def get_fruit_image_store(
    settings: Annotated[Settings, Depends(get_settings)],
) -> FruitImageStore:
    # MongoDB on the server (Render's disk is wiped on restarts), a local folder in development
    if settings.mongodb_uri:
        return MongoFruitImageStore(get_database()["fruit_images"])
    return FileFruitImageStore(settings.fruit_images_dir)


ImageStore = Annotated[FruitImageStore, Depends(get_fruit_image_store)]
