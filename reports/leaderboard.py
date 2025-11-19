from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from db.client import get_database_name, mongo_client
from macro.regime import RegimeDetector
from strategy_genome.repository import list_genomes, record_leaderboard

LEADERBOARD_DIR = Path("reports") / "leaderboards"


def _ensure_directory() -> None:
    LEADERBOARD_DIR.mkdir(parents=True, exist_ok=True)


def _get_current_regime(symbol: str = "BTC/USDT", interval: str = "1h") -> Optional[str]:
    """Get current market regime."""
    try:
        detector = RegimeDetector()
        regime = detector.get_latest_regime(symbol, interval)
        if regime:
            return regime.trend_regime.value
        return None
    except Exception:  # noqa: BLE001
        return None


def _get_regime_performance_summary(doc: Dict[str, Any], regime: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Get regime performance summary for a strategy.
    
    Args:
        doc: Strategy document
        regime: Specific regime to get performance for (or None for all)
    
    Returns:
        Regime performance summary dict
    """
    regime_performance = doc.get("regime_performance", {})
    
    if not regime_performance:
        return None
    
    if regime:
        return regime_performance.get(regime)
    
    # Return summary of all regimes
    return {
        "regimes_analyzed": list(regime_performance.keys()),
        "count": len(regime_performance),
        "preferred_regime": doc.get("preferred_regime"),
    }


def _prepare_entry(doc: Dict[str, Any], include_regime: bool = True) -> Dict[str, Any]:
    """
    Prepare leaderboard entry from strategy document.
    
    Args:
        doc: Strategy document from database
        include_regime: Whether to include regime performance data
    
    Returns:
        Formatted leaderboard entry
    """
    fitness = doc.get("fitness", {}) or {}
    entry = {
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
    
    # Add regime data if requested
    if include_regime:
        entry["preferred_regime"] = doc.get("preferred_regime")
        entry["regime_performance_available"] = bool(doc.get("regime_performance"))
        
        # Add regime badge info
        regime_perf = doc.get("regime_performance", {})
        if regime_perf:
            entry["regime_specialist"] = True
            entry["regimes_traded"] = len(regime_perf)
        else:
            entry["regime_specialist"] = False
            entry["regimes_traded"] = 0
    
    return entry


def _render_html(payload: Dict[str, Any]) -> str:
    """Render leaderboard as HTML with regime badges."""
    
    def _regime_badge(entry: Dict[str, Any]) -> str:
        """Generate regime specialist badge HTML."""
        preferred = entry.get("preferred_regime")
        if not preferred:
            return ""
        
        # Color mapping for regime badges
        badge_colors = {
            "TRENDING_UP": "#10b981",    # green
            "TRENDING_DOWN": "#ef4444",  # red
            "SIDEWAYS": "#f59e0b",       # amber
            "UNDEFINED": "#6b7280",      # gray
        }
        
        color = badge_colors.get(preferred, "#6b7280")
        regime_display = preferred.replace("_", " ").title()
        
        return f'<span style="display:inline-block;background:{color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px;">{regime_display}</span>'
    
    rows = "".join(
        f"<tr><td>{idx + 1}</td>"
        f"<td>{entry['strategy_id']}{_regime_badge(entry)}</td>"
        f"<td>{float(entry.get('roi') or 0):.4f}</td>"
        f"<td>{float(entry.get('sharpe') or 0):.2f}</td>"
        f"<td>{float(entry.get('max_drawdown') or 0):.2%}</td>"
        f"<td>{float(entry.get('forecast_alignment') or 0):.2%}</td>"
        f"<td>{float(entry.get('composite') or 0):.2f}</td></tr>"
        for idx, entry in enumerate(payload.get("top_strategies", []))
    )
    
    # Add regime filter info if present
    regime_filter_html = ""
    if payload.get("regime_filter"):
        regime_filter_html = f"""
        <div style="background:#1e293b;padding:12px;border-radius:8px;margin-bottom:16px;">
          <strong>Filtered for Regime:</strong> {payload['regime_filter'].replace('_', ' ').title()}
          {f"(Current Market Regime)" if payload.get('is_current_regime') else ""}
        </div>
        """
    
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
  {regime_filter_html}
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
  <div style="margin-top:24px;font-size:14px;color:#94a3b8;">
    <p><strong>Regime Badges:</strong> 
      <span style="display:inline-block;background:#10b981;color:white;padding:2px 8px;border-radius:4px;font-size:11px;margin:0 4px;">Trending Up</span>
      <span style="display:inline-block;background:#ef4444;color:white;padding:2px 8px;border-radius:4px;font-size:11px;margin:0 4px;">Trending Down</span>
      <span style="display:inline-block;background:#f59e0b;color:white;padding:2px 8px;border-radius:4px;font-size:11px;margin:0 4px;">Sideways</span>
    </p>
  </div>
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


def generate_regime_leaderboard(
    regime: Optional[str] = None,
    *,
    limit: int = 10,
    use_current_regime: bool = False,
    symbol: str = "BTC/USDT",
    interval: str = "1h",
    as_of: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Generate leaderboard filtered by regime specialist strategies.
    
    Args:
        regime: Specific regime to filter for (or None to use current)
        limit: Maximum number of strategies to return
        use_current_regime: If True, use current market regime
        symbol: Symbol for regime detection
        interval: Interval for regime detection
        as_of: Timestamp for leaderboard generation
    
    Returns:
        Leaderboard payload with regime-filtered strategies
    """
    _ensure_directory()
    as_of = as_of or datetime.now(timezone.utc)
    
    # Determine regime to filter by
    filter_regime = regime
    is_current = False
    
    if use_current_regime or not filter_regime:
        current_regime = _get_current_regime(symbol, interval)
        if current_regime:
            filter_regime = current_regime
            is_current = True
    
    if not filter_regime:
        # No regime available, return standard leaderboard
        return generate_leaderboard(limit=limit, as_of=as_of)
    
    # Query strategies with regime performance data
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Find strategies that have performance data for this regime
        strategies_cursor = db["strategies"].find(
            {
                f"regime_performance.{filter_regime}": {"$exists": True},
                "fitness": {"$exists": True},
            }
        )
        
        strategies = list(strategies_cursor)
    
    # Score strategies by their regime-specific performance
    scored_strategies: List[tuple[float, Dict[str, Any]]] = []
    
    for strategy in strategies:
        regime_perf = strategy.get("regime_performance", {}).get(filter_regime)
        
        if not regime_perf:
            continue
        
        # Calculate regime-specific composite score
        sharpe = float(regime_perf.get("sharpe", 0.0))
        roi = float(regime_perf.get("roi", 0.0))
        win_rate = float(regime_perf.get("win_rate", 0.0))
        max_drawdown = abs(float(regime_perf.get("max_drawdown", 0.0)))
        
        # Weighted score emphasizing regime performance
        regime_score = (sharpe * 0.4) + (roi * 0.3) + (win_rate * 0.2) - (max_drawdown * 0.1)
        
        scored_strategies.append((regime_score, strategy))
    
    # Sort by regime score descending
    scored_strategies.sort(key=lambda x: x[0], reverse=True)
    
    # Take top N strategies
    top_strategies = scored_strategies[:limit]
    
    # Prepare entries
    entries = []
    for score, strategy in top_strategies:
        entry = _prepare_entry(strategy, include_regime=True)
        
        # Add regime-specific performance data
        regime_perf = strategy.get("regime_performance", {}).get(filter_regime, {})
        entry["regime_specific"] = {
            "regime": filter_regime,
            "sharpe": regime_perf.get("sharpe"),
            "roi": regime_perf.get("roi"),
            "win_rate": regime_perf.get("win_rate"),
            "trades": regime_perf.get("trades"),
            "regime_score": round(score, 3),
        }
        
        entries.append(entry)
    
    # Build payload
    payload: Dict[str, Any] = {
        "date": as_of.date().isoformat(),
        "slug": f"{as_of.strftime('%Y%m%d')}_regime_{filter_regime.lower()}",
        "generated_at": as_of.isoformat(),
        "regime_filter": filter_regime,
        "is_current_regime": is_current,
        "symbol": symbol,
        "interval": interval,
        "top_strategies": entries,
        "scatter": [
            {
                "strategy_id": entry["strategy_id"],
                "roi": entry.get("regime_specific", {}).get("roi", 0.0),
                "sharpe": entry.get("regime_specific", {}).get("sharpe", 0.0),
                "win_rate": entry.get("regime_specific", {}).get("win_rate", 0.0),
            }
            for entry in entries
        ],
    }
    
    # Save to files
    json_path = LEADERBOARD_DIR / f"{payload['slug']}.json"
    html_path = LEADERBOARD_DIR / f"{payload['slug']}.html"
    json_path.write_text(json.dumps(payload, indent=2, default=str))
    html_path.write_text(_render_html(payload))
    
    # Record in database
    record_leaderboard(payload)
    
    return payload


def get_regime_specialists(
    limit: int = 5,
    include_all_regimes: bool = True,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get top regime specialist strategies for each regime type.
    
    Args:
        limit: Number of specialists per regime
        include_all_regimes: Whether to include all regime types
    
    Returns:
        Dictionary mapping regime -> list of top specialists
    """
    regime_types = ["TRENDING_UP", "TRENDING_DOWN", "SIDEWAYS"]
    
    if not include_all_regimes:
        # Only include current regime
        current = _get_current_regime()
        regime_types = [current] if current else regime_types
    
    specialists: Dict[str, List[Dict[str, Any]]] = {}
    
    for regime in regime_types:
        leaderboard = generate_regime_leaderboard(
            regime=regime,
            limit=limit,
            use_current_regime=False,
        )
        specialists[regime] = leaderboard.get("top_strategies", [])
    
    return specialists


