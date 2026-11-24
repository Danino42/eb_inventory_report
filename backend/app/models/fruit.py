from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, computed_field, field_validator, model_validator

BoxType = Literal["standard", "spezial", "bio"]
BOX_TYPES: tuple[BoxType, ...] = ("standard", "spezial", "bio")

# "kg" is the default; anything counted in Stk. or sold in gram packs is "pcs"
Unit = Literal["kg", "pcs"]

# "box" = part of the Früchtebox itself, "addon" = seasonal add-on ordered at extra cost
Category = Literal["box", "addon"]

Month = Annotated[int, Field(ge=1, le=12)]

# Production method the fruit is stocked in (NF-6)
Variant = Literal["conventional", "bio"]
VARIANTS: tuple[Variant, ...] = ("conventional", "bio")

# Until "Inhalt" could be set per fruit, a crate of any Hauptfrucht counted as 13.5 kg
LEGACY_CRATE_KG = 13.5


class BoxAvailability(BaseModel):
    category: Category = "box"
    months: list[Month] = []

    @field_validator("months")
    @classmethod
    def sort_unique(cls, months: list[int]) -> list[int]:
        return sorted(set(months))


# Stable identifier used in code and data, e.g. "apple_gala" or "banana-2" (see dev_names.py)
DEV_NAME_PATTERN = r"^[a-z][a-z0-9_-]*$"


class Fruit(BaseModel):
    dev_name: str = Field(pattern=DEV_NAME_PATTERN, max_length=50)
    name_de: str = Field(min_length=1, max_length=80)
    # Optional: without it the app shows the German name
    name_en: str = Field(default="", max_length=80)
    # Article number in Earlybird's system (NF-12); demo values until the real ones are known
    article_number: str = Field(default="", max_length=20)
    # Small extra info shown under the name, e.g. the apple varieties behind "apple_2"
    note: str = Field(default="", max_length=200)
    unit: Unit = "kg"
    # "Inhalt": what one crate (Kiste) holds, in the fruit's unit; one decimal place. A tap on
    # the fruit in the worker form adds this amount
    crate_content: float = Field(default=1, ge=0.1, le=1000)
    # Which stock columns the worker form shows for this fruit
    variants: list[Variant] = Field(default=["conventional", "bio"], min_length=1)
    # Only box types the fruit is offered in are present
    availability: dict[BoxType, BoxAvailability] = {}

    @model_validator(mode="before")
    @classmethod
    def _crate_content_of_older_data(cls, data: Any) -> Any:
        """Fruits saved before "Inhalt" existed: Hauptfrüchte in kg keep the 13.5 kg crate used
        until then, everything else counts 1 (the default for new fruits)"""
        if not isinstance(data, dict) or "crate_content" in data:
            return data
        boxes = (data.get("availability") or {}).values()
        categories = [
            b.get("category", "box") if isinstance(b, dict) else b.category for b in boxes
        ]
        hauptfrucht = data.get("unit", "kg") == "kg" and "box" in categories
        return {**data, "crate_content": LEGACY_CRATE_KG if hauptfrucht else 1}

    @field_validator("crate_content")
    @classmethod
    def _one_decimal(cls, value: float) -> float:
        return round(value, 1)

    @field_validator("variants")
    @classmethod
    def unique_variants(cls, variants: list[str]) -> list[str]:
        # Always in the order conventional, bio
        return [v for v in VARIANTS if v in variants]

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


class FruitOut(Fruit):
    """A fruit as the API returns it: plus the version of its uploaded picture, if there is one
    (part of the picture's address, so a new picture shows at once)"""

    image_version: str | None = None


class NewFruit(Fruit):
    """A fruit to add: without a dev name, the server makes one from the name"""

    dev_name: str = Field(default="", pattern=rf"^$|{DEV_NAME_PATTERN}", max_length=50)
