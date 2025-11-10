from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from strategy_genome.repository import list_genomes, record_leaderboard

LEADERBOARD_DIR = Path("reports") / "leaderboards"


def _ensure_directory() -> None:
    LEADERBOARD_DIR.mkdir(parents=True, exist_ok=True)


def _prepare_entry(doc: Dict[str, Any]) -> Dict[str, Any]:
    fitness = doc.get("fitness", {}) or {}
    return {
        "strategy_id": doc.get("strategy_id"),
        "family": doc.get("family"),
        "generation": doc.get("generation"),
        "status": doc.get("status"),
        "mutation_parent": doc.get("mutation_parent"),
        "roi": fitness.get("roi"),
        "sharpe": fitness.get("sharpe"),
        "max_drawdown": fitness.get("max_drawdown"),
        "forecast_alignment": fitness.get("forecast_alignment"),
        "stability": fitness.get("stability"),
        "composite": fitness.get("composite"),
        "tags": doc.get("tags", []),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else None,
    }


def _render_html(payload: Dict[str, Any]) -> str:
    rows = "".join(
        f"<tr><td>{idx + 1}</td><td>{entry['strategy_id']}</td>"
        f"<td>{float(entry.get('roi') or 0):.4f}</td>"
        f"<td>{float(entry.get('sharpe') or 0):.2f}</td>"
        f"<td>{float(entry.get('max_drawdown') or 0):.2%}</td>"
        f"<td>{float(entry.get('forecast_alignment') or 0):.2%}</td>"
        f"<td>{float(entry.get('composite') or 0):.2f}</td></tr>"
        for idx, entry in enumerate(payload.get("top_strategies", []))
    )
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Evolution Leaderboard — {payload.get('date')}</title>
  <style>
    body {{ font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
    th, td {{ padding: 8px 12px; border-bottom: 1px solid #1e293b; text-align: left; }}
    th {{ background: #1e293b; }}
    tr:nth-child(even) {{ background: rgba(148, 163, 184, 0.05); }}
  </style>
</head>
<body>
  <h1>Evolution Lab Leaderboard</h1>
  <p>Generated {payload.get('generated_at')}</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Strategy</th>
        <th>ROI</th>
        <th>Sharpe</th>
        <th>Max Drawdown</th>
        <th>Forecast Alignment</th>
        <th>Composite</th>
      </tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>
</body>
</html>
"""


def generate_leaderboard(*, limit: int = 10, as_of: Optional[datetime] = None) -> Dict[str, Any]:
    _ensure_directory()
    as_of = as_of or datetime.now(timezone.utc)
    top = list_genomes(limit=limit, sort_by="fitness.composite")
    entries = [_prepare_entry(doc) for doc in top if doc.get("fitness")]
    payload: Dict[str, Any] = {
        "date": as_of.date().isoformat(),
        "slug": as_of.strftime("%Y%m%d"),
        "generated_at": as_of.isoformat(),
        "top_strategies": entries,
        "scatter": [
            {
                "strategy_id": entry["strategy_id"],
                "roi": entry.get("roi", 0.0),
                "max_drawdown": entry.get("max_drawdown", 0.0),
                "sharpe": entry.get("sharpe", 0.0),
            }
            for entry in entries
        ],
        "lineage": [
            {
                "strategy_id": entry["strategy_id"],
                "parent": entry.get("mutation_parent"),
                "generation": entry.get("generation"),
            }
            for entry in entries
        ],
    }
    json_path = LEADERBOARD_DIR / f"{payload['slug']}.json"
    html_path = LEADERBOARD_DIR / f"{payload['slug']}.html"
    json_path.write_text(json.dumps(payload, indent=2, default=str))
    html_path.write_text(_render_html(payload))
    record_leaderboard(payload)
    return payload


def list_leaderboards() -> List[Dict[str, str]]:
    _ensure_directory()
    files = sorted(LEADERBOARD_DIR.glob("*.json"))
    history = []
    for file in files:
        history.append({"slug": file.stem, "path": str(file)})
    return history


def load_leaderboard(slug: str) -> Optional[Dict[str, Any]]:
    _ensure_directory()
    path = LEADERBOARD_DIR / f"{slug}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


