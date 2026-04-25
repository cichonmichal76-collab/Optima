from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from dateutil import parser


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).replace("\xa0", " ").strip()
    if not text:
        return None
    return re.sub(r"\s+", " ", text)


def normalize_header(value: Any) -> str:
    text = normalize_text(value) or ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def normalize_decimal(value: Any, default: Decimal | None = None) -> Decimal | None:
    if value in (None, ""):
        return default
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))

    text = normalize_text(value)
    if text is None:
        return default

    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1]

    text = text.replace(" ", "").replace("\u202f", "")
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(",", ".")

    try:
        result = Decimal(text)
    except InvalidOperation:
        return default
    return -result if negative else result


def normalize_date(value: Any) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()

    text = normalize_text(value)
    if text is None:
        return None

    for dayfirst in (False, True):
        try:
            return parser.parse(text, dayfirst=dayfirst, yearfirst=not dayfirst).date()
        except (ValueError, OverflowError):
            continue
    return None


def normalize_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value

    text = (normalize_text(value) or "").lower()
    if text in {"1", "true", "tak", "yes", "y", "active", "aktywny"}:
        return True
    if text in {"0", "false", "nie", "no", "n", "inactive", "nieaktywny"}:
        return False
    return None

