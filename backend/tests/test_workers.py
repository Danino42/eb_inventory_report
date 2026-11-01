from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_workers_are_sorted_names() -> None:
    names = client.get("/api/workers").json()
    assert len(names) == 22
    assert names[0] == "Alfred"
    # Umlauts sort like their base letter: Okan, Ömer, Pidi
    assert names.index("Okan") + 1 == names.index("Ömer") == names.index("Pidi") - 1
