from __future__ import annotations

from typing import Optional


def format_centiseconds(value: Optional[int]) -> Optional[str]:
    if value is None or value <= 0:
        return None

    seconds = value / 100
    return f"{seconds:.2f}"
