"""Knowledge base helpers used by the learning engine and assistant."""

from .repository import (
    get_entry_by_period,
    get_latest_entry,
    list_entries,
    record_entry,
)

__all__ = [
    "record_entry",
    "get_latest_entry",
    "get_entry_by_period",
    "list_entries",
]

