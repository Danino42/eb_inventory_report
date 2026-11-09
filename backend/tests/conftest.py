import mongomock
import pytest
from pymongo.database import Database


@pytest.fixture
def mongo_db() -> Database:
    """An in-memory stand-in for MongoDB (mongomock), empty for every test."""
    return mongomock.MongoClient(tz_aware=True)["eb_inventory_test"]
