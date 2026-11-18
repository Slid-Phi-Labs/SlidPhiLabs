#!/usr/bin/env python3
"""Aggregate bench.sh runs.tsv -> Markdown table + bench-results.json.

MB/s uses decimal megabytes: uncompressed_bytes / 1e6 / median_seconds.
Per-tool totals: encode/decode seconds are summed file medians, throughput is
computed from corpus totals (the standard corpus-benchmark convention).
Fails loudly if any row failed its SHA-256 round-trip check.
Usage: analyze.py header.env runs.tsv out_dir
"""
import csv
import json
import statistics
import sys
from pathlib import Path

MB = 1_000_000


def load_env(path):
    env, vers = {}, {}
    for line in Path(path).read_text().splitlines():
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.startswith("ver["):
            vers[k[4:-1]] = v
        else:
            env[k] = v
    return env, vers


def main():
    envf, tsvf, outdir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    env, vers = load_env(envf)
    rows = list(csv.DictReader(open(tsvf, newline=""), delimiter="\t"))
    bad = [r for r in rows if r["sha_ok"] != "1"]
    if bad:
        tools = sorted({r["tool"] for r in bad})
        sys.exit(f"FATAL: {len(bad)} rows failed SHA-256 parity: {tools}")

    tools, files = [], []
    tool_names = list(dict.fromkeys(r["tool"] for r in rows))
    corpus_bytes = sum(int(r["bytes"]) for r in rows if r["tool"] == tool_names[0])
    for tool in tool_names:
        tr = [r for r in rows if r["tool"] == tool]
        tb = sum(int(r["bytes"]) for r in tr)
        comp = sum(int(r["comp_bytes"]) for r in tr)
        es = sum(float(r["enc_s"]) for r in tr)
        ds = sum(float(r["dec_s"]) for r in tr)
        peak_rss = max([int(r["enc_rss_kb"]) for r in tr]
                      + [int(r["dec_rss_kb"]) for r in tr])
        tools.append({
            "tool": tool,
            "version": vers.get(tool, "unknown"),
            "uncompressed_bytes": tb,
            "compressed_bytes": comp,
            "ratio": round(comp / tb, 4),
            "encode_seconds_total": round(es, 3),
            "decode_seconds_total": round(ds, 3),
            "encode_mb_s": round(tb / MB / es, 2),
            "decode_mb_s": round(tb / MB / ds, 2),
            "peak_rss_kb": peak_rss,
            "sha256_parity": "pass",
        })
        for r in tr:
            b = int(r["bytes"])
            files.append({
                "tool": tool, "file": r["file"], "bytes": b,
                "encode_s": float(r["enc_s"]), "decode_s": float(r["dec_s"]),
                "encode_mb_s": round(b / MB / float(r["enc_s"]), 2),
                "decode_mb_s": round(b / MB / float(r["dec_s"]), 2),
                "compressed_bytes": int(r["comp_bytes"]),
            })
    tools.sort(key=lambda t: t["encode_mb_s"], reverse=True)

    md = ["| Tool | Version | Comp (B) | Ratio | Enc MB/s | Dec MB/s | Peak RSS (MB) | SHA-256 |",
          "|---|---|---|---|---|---|---|---|"]
    for t in tools:
        md.append(f"| {t['tool']} | {t['version']} | {t['compressed_bytes']} | "
                  f"{t['ratio']:.4f} | {t['encode_mb_s']:.2f} | {t['decode_mb_s']:.2f} | "
                  f"{t['peak_rss_kb']/1024:.1f} | pass |")
    (outdir / "bench-results.md").write_text(
        f"## Throughput — {env.get('cpu', '?')} / {env.get('kernel', '?')} / "
        f"{env.get('ram', '?')} / core {env.get('core', '?')} / "
        f"{env.get('runs', '?')} runs + {env.get('warmup', '?')} warm-up\n\n"
        + "\n".join(md) + "\n")

    (outdir / "bench-results.json").write_text(json.dumps({
        "header": {
            "cpu": env.get("cpu"), "kernel": env.get("kernel"), "ram": env.get("ram"),
            "pinned_core": env.get("core"), "warmup_runs": env.get("warmup"),
            "timed_runs": env.get("runs"), "date_utc": env.get("date_utc", env.get("date")),
            "corpus_files": env.get("corpus_files"),
            "corpus_bytes": corpus_bytes,
            "method": "taskset single-core, median of N timed runs, RSS via /usr/bin/time -v, "
                      "SHA-256 round-trip verified every run, MB/s = bytes/1e6/median_s",
        },
        "tools": tools,
        "files": files,
    }, indent=2) + "\n")
    print("\n".join(md))


if __name__ == "__main__":
    main()
