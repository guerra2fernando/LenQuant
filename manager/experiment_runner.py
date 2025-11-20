from __future__ import annotations

import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence
from uuid import uuid4

from db.client import get_database_name, mongo_client
from evaluation.metrics import compute_intraday_agent_metrics, summarise_intraday_cohort
from exec.risk_manager import AlertSettings, get_trading_settings
from features.cache import GLOBAL_FEATURE_CACHE
from reports.leaderboard import generate_leaderboard
from simulator.account import AccountEvent, ParentWallet, VirtualAccount
from simulator.runner import run_simulation
from strategy_genome.encoding import StrategyGenome, create_genome_from_dict
from strategy_genome.evolver import spawn_variants
from strategy_genome.repository import (
    ensure_seed_genomes,
    get_experiment_settings,
    list_genomes,
    record_queue_items,
    save_genome,
    update_genome_fitness,
    update_queue_item,
)

from monitor.metrics import record_intraday_cohort_metrics
from monitor.trade_alerts import TradeAlertClient

logger = logging.getLogger(__name__)

def _build_alert_client() -> TradeAlertClient:
    try:
        settings = get_trading_settings()
        return TradeAlertClient(settings.alerts)
    except Exception:  # noqa: BLE001
        return TradeAlertClient(AlertSettings())


ALERT_CLIENT = _build_alert_client()


def _emit_cohort_alert(cohort_id: str, alerts: List[Dict[str, Any]], alert: Dict[str, Any]) -> None:
    alerts.append(alert)
    title = (alert.get("type") or "cohort_alert").replace("_", " ").title()
    message = alert.get("message") or "Review required."
    metrics = {k: v for k, v in alert.items() if k not in {"type", "message"}}
    try:
        ALERT_CLIENT.send_cohort_alert(
            cohort_id=cohort_id,
            title=title,
            message=message,
            severity=alert.get("severity", "warning"),
            metrics=metrics if metrics else None,
        )
    except Exception:  # noqa: BLE001
        logger.debug("Failed to dispatch cohort alert for %s", cohort_id, exc_info=True)


@dataclass
class ExperimentRequest:
    symbol: Optional[str] = None
    interval: Optional[str] = None
    horizon: Optional[str] = None
    accounts: int = 20
    mutations_per_parent: int = 5
    champion_limit: int = 5
    queue_only: bool = False
    families: List[str] = field(default_factory=lambda: ["ema-cross"])

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        if payload.get("families") is None:
            payload["families"] = []
        return payload

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExperimentRequest":
        return cls(
            symbol=data.get("symbol"),
            interval=data.get("interval"),
            horizon=data.get("horizon"),
            accounts=data.get("accounts", 20),
            mutations_per_parent=data.get("mutations_per_parent", 5),
            champion_limit=data.get("champion_limit", 5),
            queue_only=data.get("queue_only", False),
            families=data.get("families") or ["ema-cross"],
        )


def _strategy_payload(genome: StrategyGenome) -> Dict[str, Any]:
    payload = genome.document()
    params = dict(payload.get("params", {}))
    params["uses_forecast"] = payload.get("uses_forecast", True)
    params["forecast_weight"] = payload.get("forecast_weight", 0.4)
    params.setdefault("risk_pct", 0.1)
    params.setdefault("take_profit_pct", 0.02)
    params.setdefault("stop_loss_pct", 0.01)
    return params


def _load_run_document(run_id: str) -> Optional[Dict[str, Any]]:
    with mongo_client() as client:
        db = client[get_database_name()]
        return db["sim_runs"].find_one({"run_id": run_id})


def _touch_queue_item(queue_item_id: str, status: str, **extra: Any) -> None:
    updates = {"status": status, "updated_at": datetime.utcnow(), **extra}
    if status == "running":
        updates.setdefault("started_at", datetime.utcnow())
    if status in {"completed", "failed"}:
        updates.setdefault("finished_at", datetime.utcnow())
    update_queue_item(queue_item_id, updates)


def run_experiment_cycle(request: ExperimentRequest) -> Dict[str, Any]:
    settings = get_experiment_settings()
    ensure_seed_genomes(request.families or settings.get("families", []))
    champions_docs = list_genomes(status="champion", limit=request.champion_limit)
    if not champions_docs:
        raise RuntimeError("No champion genomes available to seed experiments.")
    champions = [create_genome_from_dict(doc) for doc in champions_docs]
    variants = spawn_variants(
        champions,
        mutations_per_parent=request.mutations_per_parent,
    )
    if not variants:
        raise RuntimeError("Failed to spawn variants for experiment cycle.")

    # trim to requested account capacity
    account_capacity = request.accounts or settings.get("accounts", 20)
    variants = variants[: max(1, account_capacity)]

    queue_docs = record_queue_items(variants, max_queue=settings.get("max_queue"))
    if request.queue_only:
        return {"queued": len(queue_docs), "runs": []}
    if not queue_docs:
        logger.info("Experiment queue at capacity; no new runs scheduled.")
        return {"queued": 0, "completed": [], "message": "queue_at_capacity"}

    completed_runs: List[Dict[str, Any]] = []
    for variant, queue_doc in zip(variants, queue_docs):
        queue_id = queue_doc["_id"]
        saved = save_genome(variant)
        _touch_queue_item(queue_id, "running", strategy_id=saved["strategy_id"])
        try:
            strategy_config = _strategy_payload(variant)
            strategy_config["min_confidence"] = settings.get("min_confidence", strategy_config.get("min_confidence"))
            strategy_config["min_return_threshold"] = settings.get("min_return", strategy_config.get("min_return_threshold"))
            run_id = run_simulation(
                request.symbol or settings.get("symbol", "BTC/USD"),
                request.interval or settings.get("interval", "1m"),
                strategy_name=saved["strategy_id"],
                horizon=request.horizon or request.interval or settings.get("interval", "1m"),
                strategy_config=strategy_config,
                genome=saved,
            )
            run_doc = _load_run_document(run_id)
            metrics = run_doc.get("results", {}) if run_doc else {}
            updated = update_genome_fitness(saved["strategy_id"], metrics, run_id=run_id)
            _touch_queue_item(
                queue_id,
                "completed",
                run_id=run_id,
                metrics=metrics,
            )
            completed_runs.append(
                {
                    "strategy_id": saved["strategy_id"],
                    "run_id": run_id,
                    "metrics": metrics,
                    "fitness": updated.get("fitness") if updated else {},
                }
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Experiment failed for %s: %s", saved["strategy_id"], exc)
            _touch_queue_item(queue_id, "failed", error=str(exc))

    generate_leaderboard(limit=10)

    return {
        "queued": len(queue_docs),
        "completed": completed_runs,
    }


# ---------------------------------------------------------------------------
# Intraday Cohort Orchestration
# ---------------------------------------------------------------------------


def _parse_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _normalise_policy(policy: str) -> str:
    if not policy:
        return "equal"
    policy_lower = policy.lower()
    if policy_lower in {"equal", "even"}:
        return "equal"
    if policy_lower in {"risk", "risk-weighted", "risk_weighted"}:
        return "risk-weighted"
    logger.warning("Unknown allocation policy '%s'; defaulting to equal", policy)
    return "equal"


@dataclass
class IntradayCohortRequest:
    bankroll: float = 1_000.0
    agent_count: int = 30
    symbol: Optional[str] = None
    interval: Optional[str] = None
    horizon: Optional[str] = None
    allocation_policy: str = "equal"
    leverage_ceiling: Optional[float] = 5.0
    exposure_limit: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    families: List[str] = field(default_factory=lambda: ["ema-cross"])
    mutations_per_parent: int = 2
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.bankroll <= 0:
            raise ValueError("Bankroll must be greater than zero.")
        if self.agent_count <= 0:
            raise ValueError("agent_count must be greater than zero.")
        self.allocation_policy = _normalise_policy(self.allocation_policy)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["start_time"] = self.start_time.isoformat() if self.start_time else None
        payload["end_time"] = self.end_time.isoformat() if self.end_time else None
        return payload

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IntradayCohortRequest":
        return cls(
            bankroll=float(data.get("bankroll", 1_000.0)),
            agent_count=int(data.get("agent_count", 30)),
            symbol=data.get("symbol"),
            interval=data.get("interval"),
            horizon=data.get("horizon"),
            allocation_policy=data.get("allocation_policy", "equal"),
            leverage_ceiling=data.get("leverage_ceiling"),
            exposure_limit=data.get("exposure_limit"),
            start_time=_parse_datetime(data.get("start_time")),
            end_time=_parse_datetime(data.get("end_time")),
            families=data.get("families") or ["ema-cross"],
            mutations_per_parent=int(data.get("mutations_per_parent", 2)),
            metadata=dict(data.get("metadata") or {}),
        )


def _select_cohort_genomes(request: IntradayCohortRequest, settings: Dict[str, Any]) -> List[StrategyGenome]:
    families = request.families or settings.get("families", ["ema-cross"])
    ensure_seed_genomes(families)
    champion_docs = list_genomes(status="champion", limit=max(request.agent_count, settings.get("champion_limit", 5)))
    if not champion_docs:
        raise RuntimeError("No champion genomes available to seed intraday cohort.")
    champions = [create_genome_from_dict(doc) for doc in champion_docs]
    mutations_per_parent = max(1, request.mutations_per_parent)
    variants = spawn_variants(champions, mutations_per_parent=mutations_per_parent)

    selected: List[StrategyGenome] = []
    if variants:
        selected.extend(variants[: request.agent_count])
    if len(selected) < request.agent_count:
        remaining = request.agent_count - len(selected)
        selected.extend(champions[:remaining])
    return selected[: request.agent_count]


def _allocation_plan(genomes: Sequence[StrategyGenome], request: IntradayCohortRequest) -> List[float]:
    if not genomes:
        return []
    bankroll = float(request.bankroll)
    if bankroll <= 0:
        return [0.0 for _ in genomes]

    if request.allocation_policy == "risk-weighted":
        weights: List[float] = []
        for genome in genomes:
            fitness = genome.fitness
            weight = max(0.01, float(fitness.sharpe or 0.0) + float(fitness.roi or 0.0))
            weights.append(weight)
        total_weight = sum(weights)
        if total_weight == 0:
            weights = [1.0 for _ in genomes]
            total_weight = float(len(genomes))
        allocations = [bankroll * weight / total_weight for weight in weights]
    else:
        allocations = [bankroll / len(genomes) for _ in genomes]

    delta = bankroll - sum(allocations)
    if allocations:
        allocations[-1] += delta
    return [float(max(0.0, allocation)) for allocation in allocations]


def _max_trade_notional(trades: Sequence[Dict[str, Any]]) -> float:
    max_notional = 0.0
    for trade in trades or []:
        quantity = abs(float(trade.get("quantity", 0.0) or 0.0))
        entry_price = abs(float(trade.get("entry_price", 0.0) or 0.0))
        notional = quantity * entry_price
        if notional > max_notional:
            max_notional = notional
    return max_notional


def _persist_intraday_documents(cohort_doc: Dict[str, Any], summary_doc: Dict[str, Any]) -> None:
    with mongo_client() as client:
        db = client[get_database_name()]
        db["sim_runs_intraday"].insert_one(cohort_doc)
        db["cohort_summaries"].update_one(
            {"cohort_id": summary_doc["cohort_id"]},
            {"$set": {**summary_doc, "updated_at": datetime.utcnow()}},
            upsert=True,
        )


def launch_intraday_cohort(request: IntradayCohortRequest) -> Dict[str, Any]:
    settings = get_experiment_settings()
    symbol = request.symbol or settings.get("symbol", "BTC/USD")
    interval = request.interval or settings.get("interval", "1m")
    horizon = request.horizon or interval

    genomes = _select_cohort_genomes(request, settings)
    allocations = _allocation_plan(genomes, request)
    cohort_id = request.metadata.get("cohort_id") or f"cohort-{uuid4().hex[:8]}"

    parent_wallet = ParentWallet(
        name=request.metadata.get("parent_wallet_name") or f"{cohort_id}-parent",
        starting_balance=request.bankroll,
        exposure_limit=request.exposure_limit or request.bankroll,
        leverage_ceiling=request.leverage_ceiling,
        metadata={**request.metadata, "symbol": symbol, "interval": interval},
    )

    agents: List[Dict[str, Any]] = []
    cohort_alerts: List[Dict[str, Any]] = []
    failed_agents = 0
    start_clock = time.perf_counter()

    for genome, allocation in zip(genomes, allocations):
        strategy_doc = genome.document()
        strategy_id = strategy_doc.get("strategy_id")
        account = VirtualAccount(
            name=strategy_id,
            starting_balance=allocation,
            leverage_limit=request.leverage_ceiling,
            metadata={
                "family": genome.family,
                "generation": genome.generation,
                "cohort_id": cohort_id,
            },
        )

        try:
            if genome.status != "champion":
                strategy_doc = save_genome(genome)
            parent_wallet.allocate(strategy_id, allocation, metadata={"strategy_id": strategy_id})
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to allocate capital for %s: %s", strategy_id, exc)
            failed_agents += 1
            _emit_cohort_alert(
                cohort_id,
                cohort_alerts,
                {
                    "type": "allocation_error",
                    "strategy_id": strategy_id,
                    "message": str(exc),
                },
            )
            continue

        strategy_config = _strategy_payload(genome)
        strategy_config["initial_capital"] = allocation
        strategy_config.setdefault("risk_pct", min(strategy_config.get("risk_pct", 0.2), 0.5))

        context = {
            "cohort_id": cohort_id,
            "strategy_id": strategy_id,
            "allocation": allocation,
        }

        try:
            run_id = run_simulation(
                symbol,
                interval,
                strategy_name=strategy_id,
                horizon=horizon,
                strategy_config=strategy_config,
                genome=strategy_doc,
                start_time=request.start_time,
                end_time=request.end_time,
                context=context,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Simulation failed for %s: %s", strategy_id, exc)
            run_id = ""

        agent_alerts: List[Dict[str, Any]] = []
        if not run_id:
            failed_agents += 1
            parent_wallet.settle(strategy_id, allocation, metadata={"reason": "failed_simulation"})
            account.events.append(
                AccountEvent(
                    timestamp=datetime.utcnow(),
                    event_type="simulation_failed",
                    amount=allocation,
                    balance_after=allocation,
                    metadata={"strategy_id": strategy_id},
                )
            )
            _emit_cohort_alert(
                cohort_id,
                cohort_alerts,
                {
                    "type": "simulation_failed",
                    "strategy_id": strategy_id,
                    "message": "Simulation did not run",
                },
            )
            agents.append(
                {
                    "strategy_id": strategy_id,
                    "allocation": allocation,
                    "run_id": None,
                    "metrics": {},
                    "account": account.to_snapshot(),
                    "alerts": agent_alerts,
                }
            )
            continue

        run_doc = _load_run_document(run_id)
        if not run_doc:
            failed_agents += 1
            parent_wallet.settle(strategy_id, allocation, metadata={"reason": "missing_run"})
            _emit_cohort_alert(
                cohort_id,
                cohort_alerts,
                {
                    "type": "run_missing",
                    "strategy_id": strategy_id,
                    "run_id": run_id,
                    "message": "Run document not found",
                },
            )
            agents.append(
                {
                    "strategy_id": strategy_id,
                    "allocation": allocation,
                    "run_id": run_id,
                    "metrics": {},
                    "account": account.to_snapshot(),
                    "alerts": agent_alerts,
                }
            )
            continue

        run_metrics = run_doc.get("results", {}) or {}
        trades = run_doc.get("trades", []) or []
        equity_curve = run_doc.get("equity_curve", []) or []
        max_notional = _max_trade_notional(trades)

        try:
            parent_wallet.update_exposure(strategy_id, max_notional, metadata={"run_id": run_id})
        except ValueError as exc:
            alert = {
                "type": "exposure_limit",
                "strategy_id": strategy_id,
                "run_id": run_id,
                "message": str(exc),
            }
            _emit_cohort_alert(cohort_id, cohort_alerts, alert)
            agent_alerts.append(alert)

        agent_metrics = compute_intraday_agent_metrics(
            equity_curve,
            trades,
            allocation,
            request.bankroll,
            leverage_limit=request.leverage_ceiling,
            max_exposure=max_notional,
        )
        if agent_metrics.get("leverage_breach") and request.leverage_ceiling:
            leverage_multiple = 0.0
            if allocation > 0 and agent_metrics.get("max_exposure") is not None:
                leverage_multiple = float(agent_metrics["max_exposure"]) / allocation
            try:
                ALERT_CLIENT.notify_leverage_breach(
                    cohort_id=cohort_id,
                    strategy_id=strategy_id or "unknown",
                    leverage_multiple=leverage_multiple,
                    ceiling=float(request.leverage_ceiling),
                )
            except Exception:  # noqa: BLE001
                logger.debug("Failed to send leverage breach alert for %s", strategy_id, exc_info=True)
        combined_metrics = {**run_metrics, **agent_metrics}
        final_equity = float(agent_metrics.get("ending_equity", allocation + run_metrics.get("pnl", 0.0)))
        pnl = parent_wallet.settle(
            strategy_id,
            final_equity,
            metadata={"run_id": run_id, "strategy_id": strategy_id},
        )

        account.events.append(
            AccountEvent(
                timestamp=datetime.utcnow(),
                event_type="cohort_settlement",
                amount=final_equity,
                balance_after=final_equity,
                metadata={"run_id": run_id, "pnl": pnl},
            )
        )
        account.balance = final_equity
        account.metadata.update({"run_id": run_id, "allocation": allocation, "pnl": pnl})

        agents.append(
            {
                "strategy_id": strategy_id,
                "allocation": allocation,
                "run_id": run_id,
                "metrics": combined_metrics,
                "account": account.to_snapshot(),
                "alerts": agent_alerts,
            }
        )

    runtime_seconds = time.perf_counter() - start_clock
    parent_snapshot = parent_wallet.to_snapshot()
    window = {"start": request.start_time, "end": request.end_time}
    summary = summarise_intraday_cohort(agents, parent_snapshot, window=window, alerts=cohort_alerts)

    cohort_doc = {
        "_id": cohort_id,
        "cohort_id": cohort_id,
        "created_at": datetime.utcnow(),
        "symbol": symbol,
        "interval": interval,
        "horizon": horizon,
        "bankroll": request.bankroll,
        "allocation_policy": request.allocation_policy,
        "agent_count": len(agents),
        "window": window,
        "parent_wallet": parent_snapshot,
        "agents": agents,
        "alerts": cohort_alerts,
        "metadata": request.metadata,
        "summary": summary,
        "runtime_seconds": runtime_seconds,
        "failed_agents": failed_agents,
    }

    summary_doc = {
        "cohort_id": cohort_id,
        "generated_at": summary.get("generated_at", datetime.utcnow()),
        "bankroll": request.bankroll,
        "runtime_seconds": runtime_seconds,
        "agent_count": len(agents),
        "failed_agents": failed_agents,
        "total_pnl": summary.get("total_pnl", 0.0),
        "total_roi": summary.get("total_roi", 0.0),
        "bankroll_utilization_pct": summary.get("bankroll_utilization_pct", 0.0),
        "trade_count": summary.get("trade_count", 0),
        "confidence_score": summary.get("confidence_score", 0.0),
        "best_agent": summary.get("best_agent"),
        "worst_agent": summary.get("worst_agent"),
        "alerts": summary.get("alerts", []),
        "window": summary.get("window"),
    }

    _persist_intraday_documents(cohort_doc, summary_doc)
    record_intraday_cohort_metrics(
        cohort_id=cohort_id,
        runtime_seconds=runtime_seconds,
        parent_snapshot=parent_snapshot,
        agents=agents,
        alerts=cohort_alerts,
    )

    utilisation_pct = float(parent_snapshot.get("utilization", 0.0) or 0.0)
    if utilisation_pct >= 0.9 and request.bankroll > 0:
        try:
            ALERT_CLIENT.notify_bankroll_utilisation(
                cohort_id=cohort_id,
                utilisation_pct=utilisation_pct,
                threshold_pct=0.9,
            )
        except Exception:  # noqa: BLE001
            logger.debug("Failed to send bankroll utilisation alert for %s", cohort_id, exc_info=True)

    if interval in {"1m", "3m", "5m", "15m"}:
        try:
            GLOBAL_FEATURE_CACHE.invalidate(symbol, interval)
        except Exception:  # noqa: BLE001
            logger.debug("Failed to invalidate feature cache for %s %s", symbol, interval, exc_info=True)

    return {
        "cohort_id": cohort_id,
        "symbol": symbol,
        "interval": interval,
        "summary": summary,
        "parent_wallet": parent_snapshot,
        "agents": [
            {
                "strategy_id": agent["strategy_id"],
                "run_id": agent["run_id"],
                "allocation": agent["allocation"],
                "metrics": agent["metrics"],
                "alerts": agent["alerts"],
            }
            for agent in agents
        ],
        "alerts": cohort_alerts,
        "runtime_seconds": runtime_seconds,
    }
