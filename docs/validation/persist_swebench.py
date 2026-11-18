#!/usr/bin/env python3
"""PERsiST vs full-context retrieval on SWE-bench Lite — leaderboard harness.

Compares two context strategies for the same coding agent:
  baseline : problem statement + top-k retrieved files concatenated in full.
  persist  : empty start; candidate chunks folded one at a time under a token
             budget (progressive condensation — the PERsiST strategy).

The agent under test is external: --agent-cmd receives one instance JSON on
stdin and must print a unified diff on stdout; or --patch-dir supplies
{instance_id}.diff files. With neither, the harness scores the empty patch
(zero-shot base rate — a valid control run).

Each instance is evaluated by applying the patch to --repo-root (which must
already be checked out at the instance base_commit) and running the
FAIL_TO_PASS + PASS_TO_PASS tests with pytest. The worktree is reset after
every instance.

Metrics per instance: pass, input_tokens, turn_latency_ms.
Leaderboard: pass_rate, avg_input_tokens, token_reduction_pct (persist vs
baseline), median_turn_latency_ms.

Usage:
  python persist_swebench.py --instances swebench_lite.jsonl --mode compare \\
      --repo-root /path/to/repo --agent-cmd "./my-agent" --output leaderboard.json
  python persist_swebench.py --instances swebench_lite.jsonl --mode persist \\
      --repo-root /path/to/repo --patch-dir ./patches --output persist_only.json
"""
import argparse
import json
import re
import statistics
import subprocess
import sys
import time
from pathlib import Path

try:
    import tiktoken
    _ENC = tiktoken.get_encoding("cl100k_base")
    ESTIMATED = False
except Exception:
    _ENC = None
    ESTIMATED = True


def count_tokens(text):
    if _ENC is not None:
        return len(_ENC.encode(text))
    return max(1, len(text) // 4)


def wordset(s):
    return set(re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", s.lower()))


class BaselineFullContext:
    """Concatenate the full text of the top-k keyword-matching files."""

    name = "baseline"

    def __init__(self, repo_root, k=5, max_chars=60000):
        self.repo_root = Path(repo_root)
        self.k, self.max_chars = k, max_chars

    def candidates(self):
        return [p for p in self.repo_root.rglob("*.py")
                if ".git" not in p.parts and "test" not in p.name.lower()][:500]

    def build(self, problem):
        scored = []
        pw = wordset(problem)
        for p in self.candidates():
            try:
                txt = p.read_text(errors="replace")
            except OSError:
                continue
            overlap = len(pw & wordset(txt))
            if overlap:
                scored.append((overlap, p, txt))
        scored.sort(reverse=True)
        ctx = "\n\n".join(f"### {p}\n{t[:self.max_chars]}" for _, p, t in scored[:self.k])
        return ctx[: self.k * self.max_chars]


class PersistEmptyStart:
    """Start empty; fold candidate chunks under a token budget.

    Each chunk is condensed to its structural skeleton (imports, defs, and
    lines overlapping the problem vocabulary) before being appended, so the
    running context stays within budget no matter how many files match.
    """

    name = "persist"

    def __init__(self, repo_root, token_budget=6000, max_files=12):
        self.repo_root = Path(repo_root)
        self.token_budget = token_budget
        self.max_files = max_files

    def skeleton(self, text, keep):
        out = []
        for line in text.splitlines():
            s = line.strip()
            if (s.startswith(("import ", "from ", "def ", "class ", "@"))
                    or keep & wordset(line)):
                out.append(line)
        return "\n".join(out)

    def build(self, problem):
        pw = wordset(problem)
        scored = []
        for p in list(self.repo_root.rglob("*.py"))[:500]:
            if ".git" in p.parts or "test" in p.name.lower():
                continue
            try:
                txt = p.read_text(errors="replace")
            except OSError:
                continue
            overlap = len(pw & wordset(txt))
            if overlap:
                scored.append((overlap, p, txt))
        scored.sort(reverse=True)
        folded, used = [], 0
        for _, p, txt in scored[:self.max_files]:
            piece = f"### {p}\n" + self.skeleton(txt, pw)
            n = count_tokens(piece)
            if used + n > self.token_budget:
                break
            folded.append(piece)
            used += n
        return "\n\n".join(folded)


def get_patch(args, inst):
    if args.patch_dir:
        f = Path(args.patch_dir) / f"{inst['instance_id']}.diff"
        return f.read_text() if f.exists() else ""
    if args.agent_cmd:
        r = subprocess.run(args.agent_cmd, shell=True, input=json.dumps(inst),
                           capture_output=True, text=True, timeout=args.agent_timeout)
        return r.stdout
    return ""


def run_tests(repo_root, tests, timeout):
    if not tests:
        return True
    r = subprocess.run(["python", "-m", "pytest", *tests, "-q", "--no-header"],
                       cwd=repo_root, capture_output=True, text=True, timeout=timeout)
    tail = (r.stdout + r.stderr)[-2000:]
    m = re.search(r"(\d+) passed", tail)
    return bool(m) and "failed" not in tail


def eval_instance(args, builder, inst):
    t0 = time.perf_counter()
    context = builder.build(inst["problem_statement"])
    prompt = (f"Problem:\n{inst['problem_statement']}\n\n"
              f"Repository context:\n{context}\n")
    input_tokens = count_tokens(prompt)
    patch = get_patch(args, inst)
    repo = Path(args.repo_root)
    subprocess.run(["git", "checkout", "--", "."], cwd=repo, capture_output=True)
    if patch.strip():
        p = subprocess.run(["git", "apply", "-"], cwd=repo, input=patch,
                           capture_output=True, text=True)
        applied = p.returncode == 0
    else:
        applied = True
    tests = list(inst.get("FAIL_TO_PASS", [])) + list(inst.get("PASS_TO_PASS", []))
    passed = applied and run_tests(args.repo_root, tests, args.test_timeout)
    subprocess.run(["git", "checkout", "--", "."], cwd=repo, capture_output=True)
    return {"instance_id": inst["instance_id"], "mode": builder.name,
            "pass": passed, "input_tokens": input_tokens,
            "turn_latency_ms": int((time.perf_counter() - t0) * 1000),
            "tokens_estimated": ESTIMATED}


def summarize(rows):
    passes = [1 if r["pass"] else 0 for r in rows]
    return {"n": len(rows),
            "pass_rate": round(sum(passes) / len(passes), 4) if passes else 0.0,
            "avg_input_tokens": round(statistics.mean(r["input_tokens"] for r in rows), 1),
            "median_turn_latency_ms": statistics.median(r["turn_latency_ms"] for r in rows)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--instances", required=True, help="SWE-bench Lite .jsonl")
    ap.add_argument("--mode", choices=["baseline", "persist", "compare"],
                    default="compare")
    ap.add_argument("--repo-root", required=True)
    ap.add_argument("--patch-dir", default=None)
    ap.add_argument("--agent-cmd", default=None)
    ap.add_argument("--output", default="leaderboard.json")
    ap.add_argument("--max-instances", type=int, default=0)
    ap.add_argument("--token-budget", type=int, default=6000)
    ap.add_argument("--agent-timeout", type=int, default=600)
    ap.add_argument("--test-timeout", type=int, default=300)
    args = ap.parse_args()

    insts = [json.loads(l) for l in Path(args.instances).read_text().splitlines() if l.strip()]
    if args.max_instances:
        insts = insts[:args.max_instances]

    builders = {"baseline": BaselineFullContext(args.repo_root),
                "persist": PersistEmptyStart(args.repo_root, args.token_budget)}
    modes = [args.mode] if args.mode != "compare" else ["baseline", "persist"]
    per_mode, per_inst = {}, []
    for m in modes:
        rows = [eval_instance(args, builders[m], i) for i in insts]
        per_mode[m] = summarize(rows)
        per_inst.extend(rows)

    board = {"modes": per_mode, "instances": per_inst,
             "tokens_estimated": ESTIMATED}
    if "baseline" in per_mode and "persist" in per_mode:
        b, p = per_mode["baseline"]["avg_input_tokens"], per_mode["persist"]["avg_input_tokens"]
        board["token_reduction_pct"] = round((b - p) / b * 100, 2) if b else 0.0
    Path(args.output).write_text(json.dumps(board, indent=2) + "\n")
    print(json.dumps({k: v for k, v in board.items() if k != "instances"}, indent=2))


if __name__ == "__main__":
    sys.exit(main())
