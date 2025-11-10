from __future__ import annotations

import json
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple

from .llm_worker import LLMWorker, LLMWorkerError, LLMResult
from .schemas import AssistantAnswerPayload, AssistantQueryContext, EvidenceItem


@dataclass
class ExplainerResult:
    payload: AssistantAnswerPayload
    provider: str
    model_id: Optional[str]
    raw_content: Optional[str]
    grounded: bool


class AssistantExplainer:
    """Synthesises responses from evidence bundles using LLM or heuristics."""

    def __init__(
        self,
        *,
        worker: Optional[LLMWorker] = None,
    ) -> None:
        self.worker = worker or LLMWorker()

    def build_context_doc(
        self,
        question: str,
        context: AssistantQueryContext,
        evidence: Sequence[EvidenceItem],
    ) -> str:
        lines = [
            "CONTEXT:",
            f"- QUERY: {question}",
        ]
        payload = context.to_serialisable_dict()
        if payload:
            lines.append(f"- CONTEXT: {json.dumps(payload, ensure_ascii=False)}")
        lines.append("- EVIDENCE:")
        for item in evidence:
            metadata = item.metadata.copy()
            summary = item.summary or ""
            metadata_snippet = json.dumps(metadata, ensure_ascii=False) if metadata else "{}"
            lines.append(
                f"  * {item.evidence_id} ({item.kind}) :: {item.title}\n"
                f"    SUMMARY: {summary}\n"
                f"    META: {metadata_snippet}"
            )
        return "\n".join(lines)

    def _system_prompt(self) -> str:
        return (
            "You are the Lenxys Evolution Lab assistant. Answer strictly based on provided evidence.\n"
            "Return JSON with keys: summary (<=200 words), causes (array of strings), "
            "actions (array of actionable next steps), evidence_refs (array of evidence ids used). "
            "If data is missing, say so explicitly in summary or actions. Never invent metrics."
        )

    def _user_prompt(self, question: str, context_doc: str) -> str:
        return (
            f"{context_doc}\n\n"
            f"TASK: Respond to the user's question -> {question!r} using ONLY the evidence."
        )

    def synthesise(
        self,
        question: str,
        context: AssistantQueryContext,
        evidence: Sequence[EvidenceItem],
    ) -> ExplainerResult:
        context_doc = self.build_context_doc(question, context, evidence)
        provider = "disabled"
        model_id: Optional[str] = None
        raw_content: Optional[str] = None
        payload: Optional[AssistantAnswerPayload] = None
        grounded = True

        if self.worker.is_enabled():
            try:
                result = self.worker.generate_json(
                    system_prompt=self._system_prompt(),
                    user_prompt=self._user_prompt(question, context_doc),
                )
                provider = result.provider
                model_id = result.model
                raw_content = result.raw_content
                payload = self._payload_from_json(result, evidence)
            except LLMWorkerError:
                provider = "fallback"
                grounded = False
        else:
            provider = "fallback"
            grounded = False

        if payload is None:
            payload = self._fallback_payload(question, evidence)

        return ExplainerResult(
            payload=payload,
            provider=provider,
            model_id=model_id,
            raw_content=raw_content,
            grounded=grounded,
        )

    def _payload_from_json(self, result: LLMResult, evidence: Sequence[EvidenceItem]) -> Optional[AssistantAnswerPayload]:
        data = result.json_payload or {}
        if not isinstance(data, dict):
            return None
        summary = data.get("summary")
        causes = data.get("causes")
        actions = data.get("actions")
        refs = data.get("evidence_refs")
        if not summary or not isinstance(summary, str):
            return None
        return AssistantAnswerPayload(
            summary=summary.strip(),
            causes=[str(item).strip() for item in (causes or []) if str(item).strip()],
            actions=[str(item).strip() for item in (actions or []) if str(item).strip()],
            evidence_refs=self._normalise_refs(refs, evidence),
        )

    def _normalise_refs(self, refs: Optional[Sequence[str]], evidence: Sequence[EvidenceItem]) -> List[str]:
        known = {item.evidence_id for item in evidence}
        output: List[str] = []
        if refs:
            for ref in refs:
                if ref in known and ref not in output:
                    output.append(ref)
        if not output:
            output = [item.evidence_id for item in evidence]
        return output

    def _fallback_payload(self, question: str, evidence: Sequence[EvidenceItem]) -> AssistantAnswerPayload:
        if evidence:
            top = evidence[0]
            summary_parts = [
                f"Answering '{question}' using {len(evidence)} evidence items.",
                f"Top insight: {top.title} — {top.summary}",
            ]
            cause_lines = [f"{item.title}: {item.summary}" for item in evidence[:3] if item.summary]
            action_lines = [
                "Review attached evidence for deeper metrics.",
            ]
            if not cause_lines:
                cause_lines = ["Insufficient structured evidence; please review raw artefacts."]
        else:
            summary_parts = [
                f"No supporting evidence found to answer '{question}'.",
            ]
            cause_lines = ["Evidence retrieval returned zero records."]
            action_lines = [
                "Extend the lookback window or rerun simulations to gather supporting data.",
            ]
        return AssistantAnswerPayload(
            summary=" ".join(summary_parts),
            causes=cause_lines,
            actions=action_lines,
            evidence_refs=[item.evidence_id for item in evidence],
        )


