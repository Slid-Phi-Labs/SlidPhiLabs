#!/usr/bin/env python3
"""Whole-site internal link sweep for docs/site/ (Agent D, 2026-11-19).
Method per CONSISTENCY-AUDIT §8.6: collect href/src from docs/site/**/*.html
plus link targets in llms.txt/agents.txt/ai.txt/SKILL.md; resolve each against
docs/site/ trying <path>, <path>.html, <path>/index.html, plus the REWRITES
map in server.mjs (parsed live) and the gone-301 map. /api/* and /v1/* are
live handler/proxy routes, not files: classified API, not broken. External
hosts are counted, not crawled.
"""
import os, re, sys, json, posixpath
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(ROOT, "server.mjs")

GONE = {
    "/gc": "/pcc", "/aware": "/pcc", "/tru8": "/specialist", "/codec": "/pcc",
    "/ledger": "/pcc", "/gate": "/pcc", "/codex": "/about", "/divine-codex": "/about",
    "/receipts/gc-diner-dialA-mozilla.json": "/receipts/pcc-diner-dial-a-mozilla.json",
    "/receipts/pcc-diner-dialA-mozilla.json": "/receipts/pcc-diner-dial-a-mozilla.json",
}

def load_rewrites():
    txt = open(SERVER, encoding="utf-8").read()
    m = re.search(r"const REWRITES = \{(.*?)\n\};", txt, re.S)
    assert m, "REWRITES block not found"
    pairs = re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', m.group(1))
    return dict(pairs)

REWRITES = load_rewrites()

def file_exists(rel):
    return os.path.isfile(os.path.join(ROOT, rel.lstrip("/")))

def resolve(path):
    """Return (status, detail). status in ok/rewrite/gone/api/broken."""
    p = urlparse(path).path or "/"
    p = unquote(p)
    if p in REWRITES:
        t = REWRITES[p]
        return ("ok", f"rewrite->{t}") if file_exists(t) else ("broken", f"rewrite->{t} MISSING")
    if p in GONE:
        t = GONE[p]
        st, d = resolve(t)
        return (st, f"gone->{t} ({d})")
    if p == "/mcp" or p.startswith("/api/") or p.startswith("/v1/") or p == "/healthz":
        return ("api", "live handler/proxy route")
    cands = [p, p + ".html", p.rstrip("/") + "/index.html"]
    for c in cands:
        if file_exists(c):
            return ("ok", f"file {c}")
    return ("broken", "no file for " + " / ".join(cands))

SKIP_SCHEMES = ("mailto:", "tel:", "javascript:", "data:", "sms:", "blob:")
EXTERNAL_OK_HOSTS = ("github.com", "www.github.com", "smithery.ai", "registry.modelcontextprotocol.io")

def classify_link(raw, src_rel):
    """Return (kind, path_or_None, note). kind: skip/api/ok/broken/external."""
    raw = raw.strip()
    if not raw or raw.startswith("#"):
        return ("skip", None, "anchor/empty")
    if raw.lower().startswith(SKIP_SCHEMES):
        return ("skip", None, "scheme")
    if raw.startswith("//"):
        raw = "https:" + raw
    parsed = urlparse(raw)
    host = (parsed.netloc or "").lower()
    if parsed.scheme in ("http", "https"):
        if host in ("www.slidphilabs.com", "slidphilabs.com"):
            path = parsed.path or "/"
        else:
            return ("external", None, host)
    elif parsed.scheme:
        return ("skip", None, f"scheme {parsed.scheme}")
    else:
        path = parsed.path
        if not path:
            return ("skip", None, "query/fragment only")
        if not path.startswith("/"):
            base = posixpath.dirname("/" + src_rel)
            path = posixpath.normpath(posixpath.join(base, path))
    path = unquote(path)
    if path == "/":
        return ("ok", path, "root")
    return (None, path, "")

def line_no(text, pos):
    return text.count("\n", 0, pos) + 1

results = []  # (src, line, raw, status, detail)
counts = {"ok": 0, "broken": 0, "api": 0, "external": 0, "skip": 0, "files": 0}

html_files = []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = [d for d in dn if d != "node_modules"]
    for f in fn:
        if f.endswith(".html"):
            html_files.append(os.path.join(dp, f))
html_files.sort()
txt_files = [os.path.join(ROOT, n) for n in ("llms.txt", "agents.txt", "ai.txt", "SKILL.md")]

ATTR = re.compile(r'''(?:href|src)\s*=\s*["']([^"']+)["']''', re.I)
TXT_URL = re.compile(r"https://(?:www\.)?slidphilabs\.com(/[^\s\"'\)\]]*)?")
TXT_PATH = re.compile(r"`(/(?:v1|api|mcp|[\w\-.]+)(?:/[\w\-.~%]+)*)`")

def scan_file(path, is_txt=False):
    rel = os.path.relpath(path, ROOT)
    counts["files"] += 1
    text = open(path, encoding="utf-8", errors="replace").read()
    hits = []
    if is_txt:
        for m in TXT_URL.finditer(text):
            p = (m.group(1) or "/").rstrip(".,;:!?)")
            hits.append((line_no(text, m.start()), m.group(0), p))
        for m in TXT_PATH.finditer(text):
            hits.append((line_no(text, m.start()), m.group(1), m.group(1)))
    else:
        for m in ATTR.finditer(text):
            hits.append((line_no(text, m.start()), m.group(1), None))
    for ln, raw, forced in hits:
        if "${" in raw:
            counts["skip"] += 1
            continue
        if forced is not None:
            path2 = forced
            st, det = resolve(path2) if not (path2.startswith("/api/") or path2.startswith("/v1/") or path2 == "/mcp") else ("api", "live handler/proxy route")
            kind = st
        else:
            kind, path2, note = classify_link(raw, rel)
            if kind in ("skip", "external"):
                counts[kind] += 1
                continue
            if kind == "ok":
                counts["ok"] += 1
                continue
            st, det = resolve(path2)
            kind, det = st, det
        if kind == "ok":
            counts["ok"] += 1
        elif kind == "api":
            counts["api"] += 1
        elif kind == "broken":
            counts["broken"] += 1
            results.append((rel, ln, raw, det))
        else:
            counts["ok"] += 1

for f in html_files:
    scan_file(f)
for f in txt_files:
    scan_file(f, is_txt=True)

print(f"REWRITES entries: {len(REWRITES)}")
print(f"files scanned: {counts['files']} (html {len(html_files)} + txt {len(txt_files)})")
print(f"internal ok: {counts['ok']}  api-route: {counts['api']}  external (not crawled): {counts['external']}  skipped: {counts['skip']}")
print(f"BROKEN: {counts['broken']}")
for rel, ln, raw, det in sorted(results):
    print(f"BROKEN {rel}:{ln}  {raw!r}  [{det}]")
