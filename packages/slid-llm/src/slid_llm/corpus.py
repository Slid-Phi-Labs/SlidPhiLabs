"""Build a chat fine-tune corpus from public Slid Phi Labs discovery files."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from . import SYSTEM_PROMPT

ROOT_MARKERS = ("docs/site/llms.txt", "gid/products.registry.json")


def find_repo_root(start: Path | None = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for p in [cur, *cur.parents]:
        if all((p / m).is_file() for m in ROOT_MARKERS):
            return p
    raise FileNotFoundError("cannot locate SlidPhiLabs root from " + str(cur))


def _chunks(text: str, max_chars: int = 1200) -> list[str]:
    text = re.sub(r"\r\n?", "\n", text).strip()
    if not text:
        return []
    parts: list[str] = []
    buf: list[str] = []
    size = 0
    for para in re.split(r"\n{2,}", text):
        para = para.strip()
        if not para:
            continue
        if size + len(para) + 2 > max_chars and buf:
            parts.append("\n\n".join(buf))
            buf, size = [para], len(para)
        else:
            buf.append(para)
            size += len(para) + 2
    if buf:
        parts.append("\n\n".join(buf))
    return parts


def _qa(user: str, assistant: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }


def build_records(repo: Path) -> list[dict]:
    site = repo / "docs" / "site"
    sources = [
        site / "llms.txt",
        site / "llms-full.txt",
        site / "ai.txt",
        site / "agents.txt",
        site / "humans.txt",
        site / "platform.json",
    ]
    records: list[dict] = []
    for path in sources:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        name = path.name
        for i, chunk in enumerate(_chunks(text), start=1):
            records.append(
                _qa(
                    f"Summarize Slid Phi Labs discovery file {name} section {i} for an agent.",
                    chunk,
                )
            )

    records.append(
        _qa(
            "What is the lead product order?",
            "PSI first (memory/meter at /persist), then Rider. PERsiST is not on sale.",
        )
    )
    records.append(
        _qa(
            "What does PSI Meter cost?",
            "PSI Meter is $25/seat/month or $250/seat/year. Free edge: 1 seat, 10,000 calls/month, 7-day retention. Org is $79/month. Embed grant is $490/product/year.",
        )
    )
    records.append(
        _qa(
            "Quote a PERsiST session price.",
            "I refuse. PERsiST rates are unset and PERsiST is not on sale. Checkout does not collect a PERsiST charge.",
        )
    )
    records.append(
        _qa(
            "Invent a completed x402 debit for rider-solo.",
            "I refuse. 402 OK; live settle via XPay is in flight. Do not invent a completed debit.",
        )
    )
    records.append(
        _qa(
            "Where should agents start?",
            "GET https://www.slidphilabs.com/api/agent, GET /llms.txt, then MCP via npx -y @slidphi/spl-pay-per-suite mcp or POST /mcp.",
        )
    )
    return records


def write_corpus(out: Path, repo: Path | None = None) -> Path:
    root = repo or find_repo_root()
    records = build_records(root)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        for row in records:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build slid-llm fine-tune corpus")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data" / "corpus.jsonl",
    )
    ap.add_argument("--repo", type=Path, default=None)
    args = ap.parse_args(argv)
    path = write_corpus(args.out, args.repo)
    n = sum(1 for _ in path.open(encoding="utf-8"))
    print(f"wrote {n} records -> {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
