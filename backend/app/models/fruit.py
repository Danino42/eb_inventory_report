from typing import Annotated, Literal

from pydantic import BaseModel, Field, computed_field, field_validator

BoxType = Literal["standard", "spezial", "bio"]
BOX_TYPES: tuple[BoxType, ...] = ("standard", "spezial", "bio")

# "kg" is the default; anything counted in Stk. or sold in gram packs is "pcs"
Unit = Literal["kg", "pcs"]

# "box" = part of the Früchtebox itself, "addon" = seasonal add-on ordered at extra cost
Category = Literal["box", "addon"]

Month = Annotated[int, Field(ge=1, le=12)]


class BoxAvailability(BaseModel):
    category: Category = "box"
    months: list[Month] = []

    @field_validator("months")
    @classmethod
    def sort_unique(cls, months: list[int]) -> list[int]:
        return sorted(set(months))


class Fruit(BaseModel):
    # Stable identifier used in code and data, e.g. "apple_gala"
    dev_name: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=50)
    name_en: str = Field(min_length=1, max_length=80)
    name_de: str = Field(min_length=1, max_length=80)
    # Small extra info shown under the name, e.g. the apple varieties behind "apple_2"
    note: str = Field(default="", max_length=200)
    unit: Unit = "kg"
    # Only box types the fruit is offered in are present
    availability: dict[BoxType, BoxAvailability] = {}

    @computed_field
    @property
    def box_types(self) -> list[BoxType]:
        """Box types with at least one available month."""
        return [b for b in BOX_TYPES if b in self.availability and self.availability[b].months]

    @computed_field
    @property
    def months(self) -> list[int]:
        """Months in which the fruit is available in any box type."""
        return sorted({m for a in self.availability.values() for m in a.months})

    def is_available(
        self,
        month: int | None = None,
        box_type: BoxType | None = None,
        category: Category | None = None,
    ) -> bool:
        """True if at least one box type matches all given filters."""
        boxes = [box_type] if box_type else list(self.availability)
        for b in boxes:
            a = self.availability.get(b)
            if a is None or not a.months:
                continue
            if month is not None and month not in a.months:
                continue
            if category is not None and a.category != category:
                continue
            return True
        return False
