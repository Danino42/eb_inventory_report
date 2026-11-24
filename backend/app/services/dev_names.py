"""Dev names (ids) of new fruits, made from their name in the background: "Mini Watermelon" ->
"mini_watermelon"; if that is taken, "mini_watermelon-2", "mini_watermelon-3", ..."""

import re
import unicodedata

_UMLAUTS = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})
MAX_BASE_LENGTH = 40


def dev_name_for(name: str) -> str:
    """Lower case letters, digits and _ ("Äpfel grün" -> "aepfel_gruen"), starting with a letter"""
    text = unicodedata.normalize("NFKD", name.lower().translate(_UMLAUTS))
    text = text.encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "_", text).strip("_")[:MAX_BASE_LENGTH].rstrip("_")
    # custom_… is used for fruits typed into the worker form, so catalogue fruits avoid it
    if not slug or not slug[0].isalpha() or slug.startswith("custom_"):
        slug = f"fruit_{slug}".rstrip("_")
    return slug


def unique_dev_name(base: str, taken: set[str]) -> str:
    """base if it is free, otherwise base-2, base-3, ..."""
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"
