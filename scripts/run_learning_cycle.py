from __future__ import annotations

import argparse
import json
import logging

from learning.loop import run_learning_cycle

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Phase 3 learning cycle.")
    parser.add_argument("--skip-meta", action="store_true", help="Skip meta-model retraining.")
    parser.add_argument("--skip-optimizer", action="store_true", help="Skip Bayesian optimisation of genomes.")
    parser.add_argument("--skip-allocator", action="store_true", help="Skip capital allocator rebalance.")
    parser.add_argument("--skip-overfit", action="store_true", help="Skip overfitting analysis.")
    args = parser.parse_args()

    summary = run_learning_cycle(
        train_meta=not args.skip_meta,
        generate_candidates=not args.skip_optimizer,
        rebalance=not args.skip_allocator,
        evaluate_overfit=not args.skip_overfit,
    )
    print(json.dumps(summary.__dict__, default=str, indent=2))


if __name__ == "__main__":
    main()

