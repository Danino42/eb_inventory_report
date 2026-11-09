"""Where data lives: in MongoDB (e.g. Atlas) if MONGODB_URI is set, as on the Render server;
otherwise in the JSON files in backend/data/ and the outbox folder (local development, tests)."""

from functools import lru_cache

import pymongo
from pydantic import BaseModel
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConfigurationError, OperationFailure, PyMongoError

from app.core.config import get_settings
from app.services.item_store import ItemStore
from app.services.json_store import JsonListStore
from app.services.mongo_store import MongoListStore


@lru_cache
def get_database() -> Database:
    """One MongoDB connection (pool) for the whole app."""
    settings = get_settings()
    client: MongoClient = MongoClient(
        settings.mongodb_uri,
        appname="eb-inventory-backend",
        # Give up after a few seconds (default: 30 s) if the database cannot be reached
        serverSelectionTimeoutMS=8_000,
        tz_aware=True,
    )
    return client[settings.mongodb_db]


def database_status() -> str:
    """'ok' if MongoDB answers within a few seconds, otherwise the usual setup mistake."""
    try:
        with pymongo.timeout(3):
            get_database().command("ping")
    except OperationFailure:
        return "login failed"  # wrong user name or password in MONGODB_URI
    except ConfigurationError:
        return "invalid connection string"
    except PyMongoError:
        return "unreachable"  # e.g. Atlas "Network Access" does not allow the server's address
    return "ok"


def open_list_store[T: BaseModel](collection: str, file_store: JsonListStore[T]) -> ItemStore[T]:
    """The MongoDB collection if MongoDB is configured (filled from file_store's JSON file on
    first use), otherwise the JSON file itself."""
    if not get_settings().mongodb_uri:
        return file_store
    return MongoListStore.seeded_from(get_database()[collection], file_store)
