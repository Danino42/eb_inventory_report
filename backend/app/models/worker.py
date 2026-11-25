from typing import Annotated, Any

from pydantic import BaseModel, StringConstraints, model_validator

# A name as shown in the name picker. No "/" or "\": the name is part of the address when renaming
WorkerName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=60, pattern=r"^[^/\\]+$"),
]


class Worker(BaseModel):
    """A name in the worker form's name picker (Verwaltung -> Mitarbeiter)."""

    name: WorkerName

    @model_validator(mode="before")
    @classmethod
    def _from_plain_name(cls, data: Any) -> Any:
        """data/workers.json started as a plain list of names"""
        return {"name": data} if isinstance(data, str) else data
