from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from bson import ObjectId

from db.client import get_database_name, mongo_client

from .schemas import AssistantQueryContext, EvidenceItem


class AssistantRetriever:
    """Fetches relevant artefacts to ground assistant responses."""

    def __init__(
        self,
        *,
        lookback_days: int = 7,
        max_evidence: int = 5,
    ) -> None:
        self.lookback_days = lookback_days
        self.max_evidence = max_evidence

    def gather(self, query: str, context: AssistantQueryContext) -> List[EvidenceItem]:
        records: List[Tuple[float, EvidenceItem]] = []
        records.extend(self._recent_sim_runs(context))
        records.extend(self._recent_reports(context))
        records.extend(self._knowledge_summaries(context))
        records.extend(self._strategy_snapshot(context))
        records.extend(self._allocator_snapshot())
        records.extend(self._overfit_alerts(context))

        dedup: Dict[str, Tuple[float, EvidenceItem]] = {}
        for score, item in records:
            existing = dedup.get(item.evidence_id)
            if not existing or score > existing[0]:
                dedup[item.evidence_id] = (score, item)

        sorted_items = sorted(dedup.values(), key=lambda pair: pair[0], reverse=True)
        trimmed = [item for _, item in sorted_items[: self.max_evidence]]
        return trimmed

    def _recent_sim_runs(self, context: AssistantQueryContext) -> List[Tuple[float, EvidenceItem]]:
        query: Dict[str, Any] = {}
        if context.strategy_id:
            query["strategy"] = context.strategy_id
        if context.symbol:
            query["symbol"] = context.symbol
        cutoff = datetime.utcnow() - timedelta(days=self.lookback_days)
        query["created_at"] = {"$gte": cutoff}

        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db["sim_runs"]
                .find(query)
                .sort("created_at", -1)
                .limit(self.max_evidence * 2)
            )
            runs = list(cursor)

        results: List[Tuple[float, EvidenceItem]] = []
        for doc in runs:
            run_id = doc.get("run_id") or str(doc.get("_id"))
            created_at = doc.get("created_at")
            score = self._score_from_datetime(created_at)
            results.append(
                (
                    score,
                    EvidenceItem(
                        evidence_id=f"sim_runs/{run_id}",
                        kind="sim_run",
                        title=f"Simulation run {run_id}",
                        summary=_summarise_sim_run(doc),
                        score=score,
                        metadata={
                            "run_id": run_id,
                            "strategy": doc.get("strategy"),
                            "symbol": doc.get("symbol"),
                            "results": doc.get("results", {}),
                            "started_at": _iso_or_none(doc.get("start")),
                            "ended_at": _iso_or_none(doc.get("end")),
                            "created_at": _iso_or_none(created_at),
                        },
                    ),
                )
            )
        return results

    def _recent_reports(self, context: AssistantQueryContext) -> List[Tuple[float, EvidenceItem]]:
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db["daily_reports"]
                .find({})
                .sort("date", -1)
                .limit(self.max_evidence * 2)
            )
            docs = list(cursor)

        results: List[Tuple[float, EvidenceItem]] = []
        for doc in docs:
            date_str = str(doc.get("date"))
            created_at = doc.get("generated_at")
            score = self._score_from_datetime(created_at)
            if context.date and str(context.date) != date_str:
                score *= 0.8
            results.append(
                (
                    score,
                    EvidenceItem(
                        evidence_id=f"daily_reports/{date_str}",
                        kind="report",
                        title=f"Daily report {date_str}",
                        summary=(doc.get("summary") or "")[:280],
                        score=score,
                        metadata={
                            "date": date_str,
                            "top_strategies": doc.get("top_strategies", []),
                            "charts": doc.get("charts", []),
                            "generated_at": _iso_or_none(created_at),
                        },
                    ),
                )
            )
        return results

    def _knowledge_summaries(self, context: AssistantQueryContext) -> List[Tuple[float, EvidenceItem]]:
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db["knowledge_base"]
                .find({})
                .sort("created_at", -1)
                .limit(self.max_evidence * 2)
            )
            docs = list(cursor)

        results: List[Tuple[float, EvidenceItem]] = []
        for doc in docs:
            identifier = str(doc.get("_id"))
            created_at = doc.get("created_at")
            score = self._score_from_datetime(created_at)
            summary = doc.get("summary") or doc.get("headline") or ""
            results.append(
                (
                    score,
                    EvidenceItem(
                        evidence_id=f"knowledge/{identifier}",
                        kind="knowledge",
                        title=doc.get("title") or f"Knowledge entry {identifier}",
                        summary=str(summary)[:280],
                        score=score,
                        metadata={
                            "period": doc.get("period"),
                            "created_at": _iso_or_none(created_at),
                            "tags": doc.get("tags", []),
                        },
                    ),
                )
            )
        return results

    def _strategy_snapshot(self, context: AssistantQueryContext) -> List[Tuple[float, EvidenceItem]]:
        if not context.strategy_id:
            return []
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db["strategies"].find_one({"strategy_id": context.strategy_id})
        if not doc:
            return []
        updated_at = doc.get("updated_at")
        score = self._score_from_datetime(updated_at) + 0.2
        return [
            (
                score,
                EvidenceItem(
                    evidence_id=f"strategies/{context.strategy_id}",
                    kind="strategy",
                    title=f"Strategy {context.strategy_id}",
                    summary=_summarise_strategy(doc),
                    score=score,
                    metadata={
                        "fitness": doc.get("fitness"),
                        "family": doc.get("family"),
                        "generation": doc.get("generation"),
                        "status": doc.get("status"),
                        "updated_at": _iso_or_none(updated_at),
                    },
                ),
            )
        ]

    def _allocator_snapshot(self) -> List[Tuple[float, EvidenceItem]]:
        with mongo_client() as client:
            db = client[get_database_name()]
            doc = db["learning.allocations"].find_one(sort=[("created_at", -1)])
        if not doc:
            return []
        created_at = doc.get("created_at")
        score = self._score_from_datetime(created_at)
        return [
            (
                score,
                EvidenceItem(
                    evidence_id=f"learning.allocations/{doc.get('_id')}",
                    kind="allocator",
                    title="Latest allocator snapshot",
                    summary=_summarise_allocator(doc),
                    score=score,
                    metadata={
                        "expected_portfolio_return": doc.get("expected_portfolio_return"),
                        "expected_portfolio_risk": doc.get("expected_portfolio_risk"),
                        "weights": doc.get("weights", []),
                        "created_at": _iso_or_none(created_at),
                    },
                ),
            )
        ]

    def _overfit_alerts(self, context: AssistantQueryContext) -> List[Tuple[float, EvidenceItem]]:
        with mongo_client() as client:
            db = client[get_database_name()]
            cursor = (
                db["learning.overfit_alerts"]
                .find({"status": "open"})
                .sort("detected_at", -1)
                .limit(self.max_evidence)
            )
            docs = list(cursor)
        results: List[Tuple[float, EvidenceItem]] = []
        for doc in docs:
            strategy_id = doc.get("strategy_id")
            if context.strategy_id and strategy_id != context.strategy_id:
                continue
            detected_at = doc.get("detected_at")
            score = self._score_from_datetime(detected_at)
            evidence_id = f"learning.overfit_alerts/{doc.get('_id')}"
            results.append(
                (
                    score,
                    EvidenceItem(
                        evidence_id=evidence_id,
                        kind="overfit_alert",
                        title=f"Overfit alert for {strategy_id}",
                        summary=_summarise_overfit_alert(doc),
                        score=score,
                        metadata={
                            "strategy_id": strategy_id,
                            "decay": doc.get("decay"),
                            "window": doc.get("window"),
                            "detected_at": _iso_or_none(detected_at),
                        },
                    ),
                )
            )
        return results

    def _score_from_datetime(self, value: Any) -> float:
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value)
            except ValueError:
                value = None
        if not isinstance(value, datetime):
            return 0.5
        delta = datetime.utcnow() - value
        days = max(delta.total_seconds() / 86400.0, 0.0)
        freshness = max(0.1, 1.0 - (days / max(self.lookback_days, 1)))
        return min(1.0, freshness + 0.1)


def fetch_evidence_by_reference(reference: str) -> Optional[Dict[str, Any]]:
    """Resolve evidence reference ids back to stored artefacts."""
    if "/" not in reference:
        return None
    namespace, identifier = reference.split("/", 1)
    with mongo_client() as client:
        db = client[get_database_name()]
        if namespace == "sim_runs":
            doc = db["sim_runs"].find_one({"run_id": identifier}) or db["sim_runs"].find_one({"_id": identifier})
            return _normalise_doc(doc)
        if namespace == "daily_reports":
            doc = db["daily_reports"].find_one({"date": identifier})
            return _normalise_doc(doc)
        if namespace == "knowledge":
            doc = (
                db["knowledge_base"].find_one({"_id": identifier})
                or db["knowledge_base"].find_one({"period": identifier})
            )
            return _normalise_doc(doc)
        if namespace == "strategies":
            doc = db["strategies"].find_one({"strategy_id": identifier})
            return _normalise_doc(doc)
        if namespace == "learning.allocations":
            doc = db["learning.allocations"].find_one({"_id": _maybe_object_id(identifier)})
            return _normalise_doc(doc)
        if namespace == "learning.overfit_alerts":
            doc = db["learning.overfit_alerts"].find_one({"_id": _maybe_object_id(identifier)})
            return _normalise_doc(doc)
        if namespace == "models.registry":
            doc = db["models.registry"].find_one({"model_id": identifier})
            return _normalise_doc(doc)
    return None


def _summarise_sim_run(doc: Dict[str, Any]) -> str:
    results = doc.get("results") or {}
    pnl = results.get("pnl")
    roi = results.get("roi")
    sharpe = results.get("sharpe")
    trades = len(doc.get("trades") or [])
    parts: List[str] = []
    if isinstance(pnl, (int, float)):
        parts.append(f"PnL {pnl:.2f}")
    if isinstance(roi, (int, float)):
        parts.append(f"ROI {roi:.2%}")
    if isinstance(sharpe, (int, float)):
        parts.append(f"Sharpe {sharpe:.2f}")
    summary = "Simulation run summary unavailable."
    if parts:
        metrics = ", ".join(parts)
        summary = f"{doc.get('strategy')} run with {trades} trades; {metrics}"
    return summary


def _summarise_strategy(doc: Dict[str, Any]) -> str:
    fitness = doc.get("fitness") or {}
    roi = fitness.get("roi")
    sharpe = fitness.get("sharpe")
    alignment = fitness.get("forecast_alignment")
    roi_text = f"{roi:.2%}" if isinstance(roi, (int, float)) else "n/a"
    sharpe_text = f"{sharpe:.2f}" if isinstance(sharpe, (int, float)) else "n/a"
    alignment_text = f"{alignment:.1%}" if isinstance(alignment, (int, float)) else "n/a"
    return (
        f"Gen {doc.get('generation')} {doc.get('family')} status {doc.get('status')} "
        f"(ROI {roi_text}, Sharpe {sharpe_text}, Alignment {alignment_text})."
    )


def _summarise_allocator(doc: Dict[str, Any]) -> str:
    expected = doc.get("expected_portfolio_return")
    risk = doc.get("expected_portfolio_risk")
    weights = doc.get("weights") or []
    top_weight = ""
    if weights:
        leader = max(weights, key=lambda w: w.get("weight", 0.0))
        weight_value = leader.get("weight", 0.0)
        if isinstance(weight_value, (int, float)):
            top_weight = f" Top weight {leader.get('strategy_id')} @ {weight_value:.1%}."
    expected_text = f"{expected:.2%}" if isinstance(expected, (int, float)) else "n/a"
    risk_text = f"{risk:.2%}" if isinstance(risk, (int, float)) else "n/a"
    return f"Portfolio expected return {expected_text} with risk {risk_text}.{top_weight}"


def _summarise_overfit_alert(doc: Dict[str, Any]) -> str:
    decay = doc.get("decay")
    window = doc.get("window")
    decay_text = f"{decay:.2f}" if isinstance(decay, (int, float)) else "n/a"
    return f"Detected decay {decay_text} over window {window} runs."


def _iso_or_none(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    try:
        return str(value)
    except Exception:  # noqa: BLE001
        return None


def _normalise_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    payload = {}
    for key, value in doc.items():
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
        elif isinstance(value, list):
            payload[key] = [_normalise_doc(item) if isinstance(item, dict) else item for item in value]
        elif isinstance(value, dict):
            payload[key] = _normalise_doc(value)
        else:
            payload[key] = value
    if "_id" in payload:
        payload["_id"] = str(payload["_id"])
    return payload


def _maybe_object_id(value: str) -> ObjectId | str:
    try:
        return ObjectId(value)
    except Exception:  # noqa: BLE001
        return value


