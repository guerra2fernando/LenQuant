from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

LLM_PROVIDER_ENV = "ASSISTANT_LLM_PROVIDER"
OPENAI_MODEL_ENV = "OPENAI_MODEL"
GOOGLE_MODEL_ENV = "GOOGLE_MODEL"
DEFAULT_OPENAI_MODEL = " GPT-5o-mini"
DEFAULT_GOOGLE_MODEL = "gemini-1.5-flash"


class LLMWorkerError(RuntimeError):
    """Raised when an LLM call fails or is disabled."""


@dataclass
class LLMResult:
    provider: str
    model: Optional[str]
    raw_content: Optional[str]
    json_payload: Optional[Dict[str, Any]]


class LLMWorker:
    """Thin wrapper around OpenAI / Google clients with grounding safeguards."""

    def __init__(
        self,
        *,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> None:
        env_provider = os.getenv(LLM_PROVIDER_ENV, "").strip().lower()
        self.provider = (provider or env_provider or "disabled").lower()
        self.temperature = temperature
        self.model = model

    def is_enabled(self) -> bool:
        return self.provider in {"openai", "google", "gemini"}

    def _call_openai(self, system_prompt: str, user_prompt: str) -> LLMResult:
        try:
            from openai import OpenAI  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise LLMWorkerError("openai package is required for OpenAI provider") from exc

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise LLMWorkerError("OPENAI_API_KEY is missing")
        client = OpenAI(api_key=api_key)
        model = self.model or os.getenv(OPENAI_MODEL_ENV, DEFAULT_OPENAI_MODEL)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=self.temperature,
        )
        content = response.choices[0].message.content if response.choices else None
        payload = self._parse_json(content)
        return LLMResult(provider="openai", model=model, raw_content=content, json_payload=payload)

    def _call_google(self, system_prompt: str, user_prompt: str) -> LLMResult:
        try:
            import google.generativeai as genai  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise LLMWorkerError("google-generativeai package is required for Google provider") from exc

        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise LLMWorkerError("GOOGLE_API_KEY is missing")
        genai.configure(api_key=api_key)
        model_name = self.model or os.getenv(GOOGLE_MODEL_ENV, DEFAULT_GOOGLE_MODEL)
        model = genai.GenerativeModel(model_name)
        prompt = f"{system_prompt}\n\n{user_prompt}"
        response = model.generate_content(prompt)
        content = getattr(response, "text", None)
        payload = self._parse_json(content)
        return LLMResult(provider="google", model=model_name, raw_content=content, json_payload=payload)

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> LLMResult:
        if not self.is_enabled():
            raise LLMWorkerError(f"LLM provider '{self.provider}' is disabled")
        if self.provider == "openai":
            return self._call_openai(system_prompt, user_prompt)
        if self.provider in {"google", "gemini"}:
            return self._call_google(system_prompt, user_prompt)
        raise LLMWorkerError(f"Unsupported LLM provider '{self.provider}'")

    @staticmethod
    def _parse_json(content: Optional[str]) -> Optional[Dict[str, Any]]:
        if not content:
            return None
        stripped = content.strip()
        if not stripped:
            return None
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            # Attempt to locate JSON block within text.
            start = stripped.find("{")
            end = stripped.rfind("}")
            if start >= 0 and end > start:
                candidate = stripped[start : end + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    return None
            return None


def test_connection() -> LLMResult:
    """Utility used by settings endpoint to validate provider credentials."""
    worker = LLMWorker()
    if not worker.is_enabled():
        raise LLMWorkerError("LLM provider is disabled")
    system_prompt = "You are a diagnostics bot returning JSON with status and provider metadata."
    user_prompt = (
        "Return a JSON object with keys status ('ok'), provider, model, and note confirming connectivity."
    )
    return worker.generate_json(system_prompt=system_prompt, user_prompt=user_prompt)


