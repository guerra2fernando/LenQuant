from __future__ import annotations

import argparse
import json

from manager.experiment_runner import ExperimentRequest, run_experiment_cycle


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Phase 2 experiment cycle.")
    parser.add_argument("--symbol", default="BTC/USD")
    parser.add_argument("--interval", default="1m")
    parser.add_argument("--horizon", default=None)
    parser.add_argument("--accounts", type=int, default=20)
    parser.add_argument("--mutations-per-parent", type=int, default=5)
    parser.add_argument("--champion-limit", type=int, default=5)
    parser.add_argument("--queue-only", action="store_true")
    parser.add_argument(
        "--families",
        nargs="*",
        default=None,
        help="Strategy families to include (default: ema-cross).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    request = ExperimentRequest(
        symbol=args.symbol,
        interval=args.interval,
        horizon=args.horizon,
        accounts=args.accounts,
        mutations_per_parent=args.mutations_per_parent,
        champion_limit=args.champion_limit,
        queue_only=args.queue_only,
        families=args.families or ["ema-cross"],
    )
    summary = run_experiment_cycle(request)
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()


