import json
import unicodedata

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/workers", tags=["workers"])


def _sort_key(name: str) -> str:
    """Alphabetical like a German list: Ömer next to Okan, Andrés next to Andreas."""
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return plain.casefold()


@router.get("")
def list_workers() -> list[str]:
    """Names for the name picker on the worker form, sorted alphabetically (demo list for now)."""
    path = get_settings().workers_file
    if not path.exists():
        return []
    names: list[str] = json.loads(path.read_text(encoding="utf-8"))
    return sorted(names, key=_sort_key)
