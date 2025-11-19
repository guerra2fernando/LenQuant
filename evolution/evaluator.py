from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

import pandas as pd

from db.client import get_database_name, mongo_client
from simulator.runner import run_simulation
from strategy_genome.encoding import create_genome_from_dict
from strategy_genome.repository import save_genome, update_genome_fitness

from .repository import load_experiment, update_experiment
from .schemas import EvaluationConfig, EvaluationResult

logger = logging.getLogger(__name__)


def _load_run_document(run_id: str) -> Dict[str, Any]:
    with mongo_client() as client:
        db = client[get_database_name()]
        doc = db["sim_runs"].find_one({"run_id": run_id}) or {}
    return doc


def _score_from_metrics(metrics: Dict[str, Any]) -> float:
    roi = float(metrics.get("roi", 0.0))
    sharpe = float(metrics.get("sharpe", 0.0))
    drawdown = float(metrics.get("max_drawdown", 0.0))
    stability = float(metrics.get("stability", 0.0))
    composite = float(metrics.get("composite", 0.0))
    if composite:
        return composite
    score = (roi * 0.6) + (sharpe * 0.4) + (stability * 0.2) - (drawdown * 0.3)
    return float(score)


def _score_by_regime(run_id: str, min_trades: int = 20) -> Dict[str, Any]:
    """
    Group backtest trade results by regime and compute per-regime performance metrics.
    
    Args:
        run_id: Simulation run identifier
        min_trades: Minimum trades required for regime to be considered (default: 20)
    
    Returns:
        Dictionary with regime performance breakdown:
        {
            "TRENDING_UP": {"sharpe": 1.8, "roi": 0.15, "win_rate": 0.62, "trades": 45, ...},
            "TRENDING_DOWN": {"sharpe": 0.5, "roi": -0.02, "win_rate": 0.48, "trades": 30, ...},
            ...
        }
    """
    try:
        with mongo_client() as client:
            db = client[get_database_name()]
            
            # Load the run document to get trade history
            run_doc = db["sim_runs"].find_one({"run_id": run_id})
            if not run_doc:
                logger.warning("Run %s not found for regime scoring", run_id)
                return {}
            
            # Extract trades from the run
            trades = run_doc.get("trades", [])
            if not trades:
                logger.debug("No trades found for run %s", run_id)
                return {}
            
            # Load regime transitions from the run context
            context = run_doc.get("context", {})
            regime_transitions = context.get("regime_transitions", [])
            
            # Build regime lookup: map timestamp -> regime
            regime_map: Dict[datetime, Dict[str, Any]] = {}
            for transition in regime_transitions:
                ts = transition.get("timestamp")
                if ts:
                    regime_map[ts] = {
                        "trend": transition.get("trend", "UNDEFINED"),
                        "volatility": transition.get("volatility", "UNDEFINED"),
                    }
            
            # Group trades by regime
            regime_trades: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
            
            for trade in trades:
                entry_time = trade.get("entry_time") or trade.get("timestamp")
                if not entry_time:
                    continue
                
                # Find the regime at trade entry time
                regime = _find_regime_at_timestamp(entry_time, regime_map, regime_transitions)
                trend_regime = regime.get("trend", "UNDEFINED")
                
                # Skip undefined regimes
                if trend_regime == "UNDEFINED":
                    continue
                
                regime_trades[trend_regime].append(trade)
            
            # Compute metrics per regime
            regime_performance: Dict[str, Any] = {}
            
            for regime, regime_trade_list in regime_trades.items():
                trade_count = len(regime_trade_list)
                
                # Skip regimes with insufficient trades
                if trade_count < min_trades:
                    logger.debug(
                        "Skipping regime %s: only %d trades (min %d required)",
                        regime,
                        trade_count,
                        min_trades,
                    )
                    continue
                
                # Convert to DataFrame for easier computation
                trades_df = pd.DataFrame(regime_trade_list)
                
                # Extract PnL values
                pnl_values = []
                for _, trade in trades_df.iterrows():
                    pnl = trade.get("pnl") or trade.get("profit") or 0.0
                    pnl_values.append(float(pnl))
                
                if not pnl_values:
                    continue
                
                pnl_series = pd.Series(pnl_values)
                
                # Compute metrics
                total_pnl = float(pnl_series.sum())
                avg_pnl = float(pnl_series.mean())
                wins = int((pnl_series > 0).sum())
                losses = int((pnl_series < 0).sum())
                win_rate = float(wins / trade_count if trade_count > 0 else 0.0)
                
                # Compute Sharpe ratio (if sufficient data)
                sharpe = 0.0
                if len(pnl_series) >= 10 and pnl_series.std() > 0:
                    sharpe = float(pnl_series.mean() / pnl_series.std() * (252 ** 0.5))  # Annualized
                
                # Compute max drawdown
                cumulative_pnl = pnl_series.cumsum()
                running_max = cumulative_pnl.expanding().max()
                drawdowns = (cumulative_pnl - running_max) / running_max.abs().replace(0, 1)
                max_drawdown = float(drawdowns.min()) if len(drawdowns) > 0 else 0.0
                
                # Compute ROI (approximation based on avg position size if available)
                roi = 0.0
                if "position_size_usd" in trades_df.columns:
                    avg_position = trades_df["position_size_usd"].mean()
                    if avg_position > 0:
                        roi = float(total_pnl / avg_position)
                
                regime_performance[regime] = {
                    "sharpe": round(sharpe, 3),
                    "roi": round(roi, 4),
                    "win_rate": round(win_rate, 3),
                    "avg_pnl": round(avg_pnl, 4),
                    "total_pnl": round(total_pnl, 4),
                    "max_drawdown": round(max_drawdown, 4),
                    "trades": trade_count,
                    "wins": wins,
                    "losses": losses,
                }
            
            logger.info(
                "Regime scoring for run %s: %d regimes analyzed",
                run_id,
                len(regime_performance),
            )
            
            return regime_performance
            
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to score by regime for run %s: %s", run_id, exc)
        return {}


def _find_regime_at_timestamp(
    timestamp: datetime,
    regime_map: Dict[datetime, Dict[str, Any]],
    regime_transitions: List[Dict[str, Any]],
) -> Dict[str, str]:
    """
    Find the regime that was active at a specific timestamp.
    
    Args:
        timestamp: The timestamp to query
        regime_map: Direct timestamp -> regime mapping
        regime_transitions: List of regime transition events
    
    Returns:
        Dictionary with 'trend' and 'volatility' regime labels
    """
    # Direct lookup first
    if timestamp in regime_map:
        return regime_map[timestamp]
    
    # Find the most recent regime before this timestamp
    best_regime = {"trend": "UNDEFINED", "volatility": "UNDEFINED"}
    best_time = None
    
    for transition in regime_transitions:
        transition_time = transition.get("timestamp")
        if transition_time and transition_time <= timestamp:
            if best_time is None or transition_time > best_time:
                best_time = transition_time
                best_regime = {
                    "trend": transition.get("trend", "UNDEFINED"),
                    "volatility": transition.get("volatility", "UNDEFINED"),
                }
    
    return best_regime


def _determine_preferred_regime(regime_performance: Dict[str, Any]) -> Optional[str]:
    """
    Determine which regime the strategy performs best in.
    
    Args:
        regime_performance: Per-regime metrics dictionary
    
    Returns:
        Regime label where strategy excels, or None if no clear preference
    """
    if not regime_performance:
        return None
    
    # Score each regime by composite metric (Sharpe + ROI - Drawdown)
    regime_scores: Dict[str, float] = {}
    
    for regime, metrics in regime_performance.items():
        sharpe = float(metrics.get("sharpe", 0.0))
        roi = float(metrics.get("roi", 0.0))
        drawdown = abs(float(metrics.get("max_drawdown", 0.0)))
        win_rate = float(metrics.get("win_rate", 0.0))
        
        # Weighted composite score
        score = (sharpe * 0.4) + (roi * 0.3) + (win_rate * 0.2) - (drawdown * 0.1)
        regime_scores[regime] = score
    
    if not regime_scores:
        return None
    
    # Find best regime
    best_regime = max(regime_scores.items(), key=lambda x: x[1])
    
    # Only return preference if significantly better than average
    avg_score = sum(regime_scores.values()) / len(regime_scores)
    if best_regime[1] > avg_score * 1.2:  # 20% better than average
        return best_regime[0]
    
    return None


def _strategy_payload(genome_doc: Dict[str, Any], candidate: Dict[str, Any], config: EvaluationConfig) -> Dict[str, Any]:
    params = dict(genome_doc.get("params", {}))
    params.setdefault("uses_forecast", genome_doc.get("uses_forecast", True))
    params.setdefault("forecast_weight", genome_doc.get("forecast_weight", params.get("forecast_weight", 0.4)))
    params.setdefault("risk_pct", params.get("risk_pct", 0.05))
    params.setdefault("take_profit_pct", params.get("take_profit_pct", 0.02))
    params.setdefault("stop_loss_pct", params.get("stop_loss_pct", 0.01))
    metadata = dict(candidate.get("metadata") or {})
    params["features"] = metadata.get("features", [])
    params["model_type"] = metadata.get("model_type", "LGBM")
    params["horizon"] = metadata.get("horizon", config.horizon)
    return params


def evaluate_experiment(experiment_id: str, config: EvaluationConfig) -> Optional[EvaluationResult]:
    experiment = load_experiment(experiment_id)
    if not experiment:
        logger.warning("Experiment %s not found", experiment_id)
        return None
    candidate = experiment.get("candidate") or {}
    genome_doc = candidate.get("genome")
    if not genome_doc:
        logger.warning("Experiment %s missing genome doc", experiment_id)
        update_experiment(experiment_id, {"status": "failed", "insights": {"reason": "missing_genome"}})
        return None

    try:
        genome = create_genome_from_dict(genome_doc)
        saved = save_genome(genome)
        strategy_id = saved["strategy_id"]
        strategy_config = _strategy_payload(genome_doc, candidate, config)
        horizon = strategy_config.get("horizon", config.horizon)
        run_id = run_simulation(
            config.symbol,
            horizon,
            strategy_name=strategy_id,
            horizon=horizon,
            strategy_config=strategy_config,
            genome=saved,
        )
        if not run_id:
            raise RuntimeError("Simulation did not produce a run identifier")
        run_doc = _load_run_document(run_id)
        metrics = run_doc.get("results", {}) if run_doc else {}
        
        # Compute regime-specific performance
        regime_performance = _score_by_regime(run_id, min_trades=20)
        preferred_regime = _determine_preferred_regime(regime_performance)
        
        # Update genome fitness with regime data
        updated = update_genome_fitness(strategy_id, metrics, run_id=run_id)
        
        # Store regime performance in strategy document
        if regime_performance:
            with mongo_client() as client:
                db = client[get_database_name()]
                db["strategies"].update_one(
                    {"strategy_id": strategy_id},
                    {
                        "$set": {
                            "regime_performance": regime_performance,
                            "preferred_regime": preferred_regime,
                            "regime_analysis_updated_at": datetime.utcnow(),
                        }
                    },
                    upsert=False,
                )
                logger.info(
                    "Stored regime performance for strategy %s: preferred_regime=%s",
                    strategy_id,
                    preferred_regime,
                )
        
        score = _score_from_metrics(updated.get("fitness", {}) if updated else metrics)
        update_experiment(
            experiment_id,
            {
                "status": "completed",
                "metrics": metrics,
                "score": score,
                "updated_at": datetime.utcnow(),
                "insights": {
                    "horizon": strategy_config.get("horizon"),
                    "model_type": strategy_config.get("model_type"),
                    "regime_performance_count": len(regime_performance),
                    "preferred_regime": preferred_regime,
                },
                "candidate": {
                    **candidate,
                    "genome": saved,
                },
            },
        )
        return EvaluationResult(
            experiment_id=experiment_id,
            strategy_id=strategy_id,
            metrics=metrics,
            score=score,
            run_id=run_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Evaluation failed for experiment %s: %s", experiment_id, exc)
        update_experiment(
            experiment_id,
            {"status": "failed", "insights": {"error": str(exc)}},
        )
        return None


def evaluate_batch(experiment_ids: Sequence[str], config: EvaluationConfig) -> List[EvaluationResult]:
    results: List[EvaluationResult] = []
    for experiment_id in experiment_ids:
        result = evaluate_experiment(experiment_id, config)
        if result:
            results.append(result)
    return results

