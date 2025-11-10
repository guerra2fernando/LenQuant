from __future__ import annotations

from pathlib import Path

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

__all__ = ["ARTIFACTS_DIR"]

