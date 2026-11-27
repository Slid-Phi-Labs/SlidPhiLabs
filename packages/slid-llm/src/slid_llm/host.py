"""Local host door: chat via Ollama tag `slid-llm` (or OpenAI-compatible URL)."""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from typing import Any

from . import DEFAULT_OLLAMA_TAG, SYSTEM_PROMPT


class HostError(RuntimeError):
    """Raised when the local model host refuses or fails a call."""


def _post_json(url: str, body: dict[str, Any], timeout: float = 120.0) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HostError(f"host HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise HostError(f"host unreachable: {exc}") from exc


def chat(
    prompt: str,
    *,
    model: str | None = None,
    base_url: str | None = None,
    system: str | None = None,
    temperature: float = 0.2,
) -> str:
    """Send one user turn. Refuses empty prompts."""
    text = (prompt or "").strip()
    if not text:
        raise HostError("refuse empty prompt")
    if text.lower() in {"invent persist price", "fake x402 debit"}:
        raise HostError("refuse unsafe lab request")

    host = (base_url or os.environ.get("SLID_LLM_URL") or "http://127.0.0.1:11434").rstrip("/")
    tag = model or os.environ.get("SLID_LLM_MODEL") or DEFAULT_OLLAMA_TAG
    sys_msg = system or SYSTEM_PROMPT

    # Prefer OpenAI-compatible /v1/chat/completions (Ollama + many hosts).
    try:
        out = _post_json(
            f"{host}/v1/chat/completions",
            {
                "model": tag,
                "temperature": temperature,
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": text},
                ],
            },
        )
        choices = out.get("choices") or []
        if not choices:
            raise HostError("invalid host response: no choices")
        msg = choices[0].get("message") or {}
        content = msg.get("content")
        if not isinstance(content, str) or not content.strip():
            raise HostError("invalid host response: empty content")
        return content.strip()
    except HostError:
        # Fall back to native Ollama /api/chat.
        out = _post_json(
            f"{host}/api/chat",
            {
                "model": tag,
                "stream": False,
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": text},
                ],
                "options": {"temperature": temperature},
            },
        )
        content = (out.get("message") or {}).get("content")
        if not isinstance(content, str) or not content.strip():
            raise HostError("invalid ollama response: empty content")
        return content.strip()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Chat with local slid-llm host")
    ap.add_argument("prompt", nargs="?", default="What is the lead product?")
    ap.add_argument("--model", default=None)
    ap.add_argument("--base-url", default=None)
    args = ap.parse_args(argv)
    print(chat(args.prompt, model=args.model, base_url=args.base_url))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
