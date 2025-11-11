from __future__ import annotations

import argparse
import json
from datetime import datetime
from typing import Any, Dict

from manager.experiment_runner import IntradayCohortRequest, launch_intraday_cohort


def _parse_iso8601(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:  # pragma: no cover - CLI validation
        msg = f"Invalid ISO-8601 timestamp: {value}"
        raise argparse.ArgumentTypeError(msg) from exc


def _parse_metadata(value: str | None) -> Dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:  # pragma: no cover - CLI validation
        raise argparse.ArgumentTypeError("metadata must be valid JSON") from exc
    if not isinstance(parsed, dict):  # pragma: no cover - CLI validation
        raise argparse.ArgumentTypeError("metadata JSON must be an object")
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Launch an intraday cohort across multiple agents.")
    parser.add_argument("--bankroll", type=float, default=1_000.0, help="Total bankroll shared across agents")
    parser.add_argument("--agent-count", type=int, default=30, help="Number of agents in the cohort")
    parser.add_argument("--symbol", type=str, default=None, help="Trading symbol override (e.g. BTC/USDT)")
    parser.add_argument("--interval", type=str, default=None, help="Base timeframe (default inherited from settings)")
    parser.add_argument("--horizon", type=str, default=None, help="Forecast horizon override")
    parser.add_argument(
        "--allocation-policy",
        type=str,
        default="equal",
        choices=["equal", "risk-weighted"],
        help="Capital allocation policy across agents",
    )
    parser.add_argument("--leverage-ceiling", type=float, default=5.0, help="Max leverage per agent before alerting")
    parser.add_argument("--exposure-limit", type=float, default=None, help="Aggregate exposure cap for the cohort")
    parser.add_argument("--start-time", type=_parse_iso8601, default=None, help="Optional ISO start timestamp (UTC)")
    parser.add_argument("--end-time", type=_parse_iso8601, default=None, help="Optional ISO end timestamp (UTC)")
    parser.add_argument(
        "--families",
        nargs="*",
        default=None,
        help="Strategy families to sample from (default: ema-cross)",
    )
    parser.add_argument(
        "--mutations-per-parent",
        type=int,
        default=2,
        help="Variants spawned per champion when building cohort",
    )
    parser.add_argument(
        "--metadata",
        type=_parse_metadata,
        default=None,
        help="Additional metadata JSON payload to tag the cohort",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metadata = args.metadata or {}
    request = IntradayCohortRequest(
        bankroll=args.bankroll,
        agent_count=args.agent_count,
        symbol=args.symbol,
        interval=args.interval,
        horizon=args.horizon,
        allocation_policy=args.allocation_policy,
        leverage_ceiling=args.leverage_ceiling,
        exposure_limit=args.exposure_limit,
        start_time=args.start_time,
        end_time=args.end_time,
        families=args.families or ["ema-cross"],
        mutations_per_parent=args.mutations_per_parent,
        metadata=metadata,
    )
    summary = launch_intraday_cohort(request)
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
