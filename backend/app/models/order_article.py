from typing import Literal

from pydantic import BaseModel, Field

# Units as printed on the supplier order list: kg, pieces (Stk) and trays (Sch = Schale)
OrderUnit = Literal["kg", "Stk", "Sch"]


class OrderArticle(BaseModel):
    """An article that is ordered regularly (one line of the supplier order list).

    Mock data for now; later these come automatically from the Access database, so the fields
    mirror the printed list:
    Lieferant | EP | Artikel / Text | EK-Menge | Anz. Kisten | Bestellmenge
    """

    # Stable id; assigned by the server for new articles (later: the Access record id)
    id: str = Field(default="", pattern=r"^$|^[a-z0-9-]{1,40}$")
    supplier: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=160)
    # EP: price per unit in CHF
    unit_price: float = Field(ge=0, le=10_000)
    unit: OrderUnit = "kg"
    # EK-Menge: how much is needed ("wir brauchen")
    ek_quantity: float = Field(ge=0, le=100_000)
    # Anz. Kisten: number of crates, if the supplier delivers in crates
    crates: int | None = Field(default=None, ge=0, le=10_000)
    # Bestellmenge: how much is ordered (less than EK-Menge if there is enough in stock)
    order_quantity: float = Field(ge=0, le=100_000)
    # Optional link to the fruit catalogue (dev name), e.g. for the icon
    fruit: str = Field(default="", max_length=50)
