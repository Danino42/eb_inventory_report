from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Lets the frontend (and hosting platforms) check that the API is reachable."""
    return {"status": "ok"}
