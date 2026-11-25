#!/usr/bin/env python3
"""GID — Gap-ID Fix Betterment Loop.

Scores every product in products.registry.json 1-100, finds gaps per
rubric.md, applies safe smart fixes, keeps standing records.

Usage:
    python gid.py [--score-only] [--no-fix] [--product NAME]
                  [--registry PATH] [--root PATH]

Outputs:
    standings.jsonl  append-only, one record per product per run
    STANDINGS.md     regenerated league table
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_REGISTRY = HERE / "products.registry.json"
DEFAULT_ROOT = HERE.parent  # SlidPhiLabs/
STANDINGS_JSONL = HERE / "standings.jsonl"
STANDINGS_MD = HERE / "STANDINGS.md"

SECRET_RE = re.compile(
    r"(api[_-]?key|secret|password)\s*=\s*['\"][^'\"]{4,}['\"]",
    re.IGNORECASE,
)
RUST_TEST_RE = re.compile(r"#\[test\]")
PLACEHOLDER_RE = re.compile(r"\b(TODO|PLACEHOLDER|TBD|FIXME)\b", re.IGNORECASE)

CHECKS = [
    ("G-FUNC-01", "Manifest present", "Functionality"),
    ("G-FUNC-02", "Entry source present", "Functionality"),
    ("G-REL-01", "Tests present", "Reliability"),
    ("G-REL-02", "Test script wired", "Reliability"),
    ("G-SEC-01", "License present", "Security"),
    ("G-SEC-02", "No plaintext secrets", "Security"),
    ("G-DOC-01", "README present + substantive", "Docs"),
    ("G-DOC-02", "NOTICE / CHANGELOG present", "Docs"),
    ("G-OPS-01", "Versioned past scaffold", "Ops"),
    ("G-OPS-02", "No scaffold placeholders", "Ops"),
]

SAFE_FIXABLE = {"G-DOC-01", "G-DOC-02"}


def find_manifest(
    pdir: Path, root: Path, prefer_cargo: bool = False
) -> tuple[str | None, dict, Path | None]:
    """Nearest manifest: pdir itself, then upward (to root incl. for in-root
    paths; pdir + one parent for out-of-root paths like ../psi/...).
    prefer_cargo puts Cargo.toml first: a Rust-focused arm is owned by
    its crate manifest even when an npm manifest sits beside it."""
    try:
        pdir.resolve().relative_to(root.resolve())
        inside = True
    except ValueError:
        inside = False
    cands = [pdir]
    if inside:
        # Stop before the registry root itself: the monorepo manifest
        # packages nothing, so an unpackaged product must stay a gap.
        cur = pdir.parent
        rres = root.resolve()
        rend = rres.parent
        while cur != rend and len(cands) < 6:
            if cur.resolve() == rres:
                break
            cands.append(cur)
            cur = cur.parent
    else:
        cands.append(pdir.parent)
    order = ("package.json", "pyproject.toml", "Cargo.toml")
    if prefer_cargo:
        order = ("Cargo.toml", "package.json", "pyproject.toml")
    for c in cands:
        for name in order:
            f = c / name
            if not f.is_file():
                continue
            if name == "package.json":
                try:
                    return name, json.loads(
                        f.read_text(encoding="utf-8", errors="replace")), c
                except (json.JSONDecodeError, OSError):
                    return name, {}, c
            if name == "pyproject.toml" and tomllib is not None:
                # Python equivalent of a wired manifest: project metadata
                # plus a pytest section that makes `pytest` runnable.
                try:
                    data = tomllib.loads(
                        f.read_text(encoding="utf-8", errors="replace"))
                except (OSError, ValueError):
                    return name, {}, c
                out: dict = {}
                proj = data.get("project", {})
                if isinstance(proj, dict) and proj.get("version"):
                    out["version"] = str(proj["version"])
                tool = data.get("tool", {})
                if isinstance(tool, dict):
                    py = tool.get("pytest", {})
                    if isinstance(py, dict) and isinstance(
                            py.get("ini_options"), dict):
                        out["_pytest"] = True
                return name, out, c
            return name, {}, c
    return None, {}, None


SOURCE_SUFFIXES = (".mjs", ".js", ".cjs", ".py", ".ts", ".sh", ".rs")

try:
    import tomllib
except ImportError:  # Python < 3.11: no pyproject parsing
    tomllib = None


TEST_BASENAMES = {
    "test.mjs", "test.js", "test.cjs", "test.py", "test.ts", "test.sh",
}


def is_test_file(f: Path) -> bool:
    n = f.name
    return (
        ".test." in n
        or n.startswith("test_")
        or n.startswith("test-")
        or n in TEST_BASENAMES
        or n.endswith(("_test.py", "_test.mjs", "_test.js"))
    )


def has_upward(pdir: Path, root: Path, name: str) -> bool:
    """True when name exists in pdir or an owning parent (to root inclusive
    for in-root paths; pdir + one parent for out-of-root paths)."""
    try:
        pdir.resolve().relative_to(root.resolve())
        inside = True
    except ValueError:
        inside = False
    if not inside:
        return (pdir / name).is_file() or (pdir.parent / name).is_file()
    cur = pdir
    rend = root.resolve().parent
    while True:
        if (cur / name).is_file():
            return True
        if cur.resolve() == root.resolve() or cur == rend:
            return False
        cur = cur.parent


def read_head(f: Path | None, lines: int = 40, chars: int = 2000) -> str:
    if f is None or not f.is_file():
        return ""
    try:
        return "\n".join(
            f.read_text(encoding="utf-8", errors="replace").splitlines()[:lines]
        )[:chars]
    except OSError:
        return ""


def check_product(
    pdir: Path,
    manifest: dict,
    root: Path,
    manifest_file: Path | None = None,
    focus: list[str] | None = None,
) -> dict[str, bool]:
    focus_files: list[Path] = []
    if focus:
        # Single-module arms may live in src/ (Rust layout), not the top level.
        search_dirs = [pdir]
        if (pdir / "src").is_dir():
            search_dirs.append(pdir / "src")
        try:
            for _d in search_dirs:
                focus_files += [
                    f for f in _d.iterdir()
                    if f.is_file() and any(s in f.name for s in focus)
                ]
        except OSError:
            focus_files = []
    if focus:
        src_ok = any(
            f.suffix in SOURCE_SUFFIXES and not is_test_file(f)
            for f in focus_files
        )
    else:
        src_ok = (pdir / "src").is_dir() and any((pdir / "src").iterdir())
        if not src_ok:
            # Flat-layout products: a top-level importable/runnable module
            # (single-file client, script) IS the entry source.
            try:
                top = list(pdir.iterdir())
            except OSError:
                top = []
            src_ok = any(
                f.is_file() and f.suffix in SOURCE_SUFFIXES
                and not is_test_file(f) for f in top
            )
    if focus:
        # Single-file module: a focus-matched test file counts as its tests.
        test_files = any(is_test_file(f) for f in focus_files)
        test_dir = bool(test_files)
    else:
        test_dir = (pdir / "test").is_dir() or (pdir / "tests").is_dir()
        test_files = False
        for td in ("test", "tests"):
            d = pdir / td
            if d.is_dir() and any(d.iterdir()):
                test_files = True
        if not test_files:
            # Python / flat layouts: top-level test_*.py, *_test.py, *.test.mjs
            try:
                top = list(pdir.iterdir())
            except OSError:
                top = []
            for f in top:
                if f.is_file() and is_test_file(f):
                    test_files = True
                    test_dir = True
                    break
    test_script = bool(
        isinstance(manifest, dict)
        and isinstance(manifest.get("scripts"), dict)
        and manifest["scripts"].get("test")
    )
    # Rust in-source tests: #[test] fns live inside src/*.rs by convention.
    # The product's own manifest plus present tests means `cargo test`
    # is a real, wired test path.
    rs_files: list[Path] = []
    if focus:
        rs_files = [f for f in focus_files if f.suffix == ".rs"]
    else:
        try:
            rs_files = [f for f in pdir.glob("*.rs") if f.is_file()]
            srcd = pdir / "src"
            if srcd.is_dir():
                rs_files += [f for f in srcd.glob("*.rs") if f.is_file()]
        except OSError:
            rs_files = []
    rust_tests = False
    for rf in rs_files:
        try:
            if rf.stat().st_size > 500_000:
                continue
            if RUST_TEST_RE.search(
                rf.read_text(encoding="utf-8", errors="replace")
            ):
                rust_tests = True
                break
        except OSError:
            continue
    cargo_wired = (
        manifest_file is not None
        and manifest_file.name == "Cargo.toml"
        and rust_tests
    )
    # Python / shell equivalents of a wired `npm test`: a pytest section in
    # pyproject, or a runnable test-*.sh / test-tools.sh in the product dir.
    pytest_wired = bool(isinstance(manifest, dict) and manifest.get("_pytest"))
    try:
        top_files = list(pdir.iterdir())
    except OSError:
        top_files = []
    shtest_wired = any(
        f.is_file() and f.suffix == ".sh" and is_test_file(f)
        for f in top_files
    )
    lic_ok = has_upward(pdir, root, "LICENSE")
    readme = pdir / "README.md"
    readme_ok = readme.is_file() and len(
        readme.read_text(encoding="utf-8", errors="replace")
    ) > 500
    notice_ok = (pdir / "NOTICE").is_file() and (pdir / "CHANGELOG.md").is_file()

    secrets_ok = True
    probes: list[Path | None] = [manifest_file, readme] + list(focus_files or [])
    for probe in probes:
        if probe is None or not probe.is_file():
            continue
        # Test fixtures carry dummy secrets by nature; the scan covers
        # shipped files, not test doubles.
        if is_test_file(probe):
            continue
        try:
            if probe.stat().st_size > 500_000:
                continue
            if SECRET_RE.search(
                probe.read_text(encoding="utf-8", errors="replace")
            ):
                secrets_ok = False
        except OSError:
            pass

    version = manifest.get("version", "") if isinstance(manifest, dict) else ""
    versioned_ok = bool(
        (version and version != "0.1.0") or (pdir / "CHANGELOG.md").is_file()
    )

    head = read_head(readme) + "\n" + read_head(manifest_file)
    for f in focus_files or []:
        try:
            if f.suffix in SOURCE_SUFFIXES and f.stat().st_size <= 500_000:
                head += "\n" + read_head(f, lines=15)
        except OSError:
            pass
    placeholders_ok = not bool(PLACEHOLDER_RE.search(head))

    return {
        "G-FUNC-01": manifest_file is not None,
        "G-FUNC-02": bool(src_ok),
        "G-REL-01": bool((test_dir and test_files) or rust_tests),
        "G-REL-02": bool(test_script or pytest_wired or shtest_wired or cargo_wired),
        "G-SEC-01": bool(lic_ok),
        "G-SEC-02": bool(secrets_ok),
        "G-DOC-01": bool(readme_ok),
        "G-DOC-02": bool(notice_ok),
        "G-OPS-01": bool(versioned_ok),
        "G-OPS-02": bool(placeholders_ok),
    }


FIX_GUIDANCE = {
    "G-FUNC-01": "Add package.json/pyproject.toml with name, version, test script.",
    "G-FUNC-02": "Add src/ with the product entry point.",
    "G-REL-01": "Scaffold test/ with one smoke test for the happy path.",
    "G-REL-02": 'Add a "test" script to the manifest (e.g. node --test test/).',
    "G-SEC-01": "Copy the owning project's license set (lab dual-license trio / psi commercial LICENSE) — never mix them.",
    "G-SEC-02": "Move the literal into vault/env config; never commit live secrets.",
    "G-DOC-01": "Auto-fixable: stub README created from manifest name/version.",
    "G-DOC-02": "Auto-fixable: stub NOTICE / CHANGELOG.md created.",
    "G-OPS-01": "Cut a version past 0.1.0 with a CHANGELOG entry.",
    "G-OPS-02": "Fill each TODO/PLACEHOLDER or file an issue and drop the marker.",
}


DUAL_LICENSE_NOTE = (
    "Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc "
    "Commercial License. See the LICENSE files at the owning "
    "project root."
)
COMMERCIAL_LICENSE_NOTE = (
    "All rights reserved under the Slid Phi Labs Commercial License. "
    "See the LICENSE file at the owning project root. No open-source "
    "license applies."
)


def safe_fix(
    pdir: Path, gap: str, manifest: dict, commercial: bool = False
) -> str | None:
    """Apply additive boilerplate fixes. Returns description or None."""
    name = manifest.get("name", pdir.name) if isinstance(manifest, dict) else pdir.name
    version = manifest.get("version", "0.1.0") if isinstance(manifest, dict) else "0.1.0"
    lic = COMMERCIAL_LICENSE_NOTE if commercial else DUAL_LICENSE_NOTE
    try:
        if gap == "G-DOC-01" and not (pdir / "README.md").is_file():
            (pdir / "README.md").write_text(
                f"# {name}\n\n> GID starter README ({version}). Flesh out each "
                "section below with the product's real behavior before calling "
                "this doc done.\n\n"
                f"## What {name} does\n\nShort paragraph: who it serves, what "
                "it computes or serves, and where it sits in the lab stack.\n\n"
                "## Install\n\nCommands to install, required runtimes, and "
                "environment variables. Keep secrets in the vault, never here.\n\n"
                "## Usage\n\nMinimal end-to-end example with real commands and "
                "expected output. Link the entry point under src/.\n\n"
                "## Testing\n\nHow to run the suite and what it covers.\n\n"
                f"## License\n\n{lic}\n",
                encoding="utf-8",
            )
            return "created README.md starter (>500 chars)"
        if gap == "G-DOC-02":
            made = []
            if not (pdir / "NOTICE").is_file():
                (pdir / "NOTICE").write_text(
                    f"{name} {version}\n{lic}\n",
                    encoding="utf-8",
                )
                made.append("NOTICE")
            if not (pdir / "CHANGELOG.md").is_file():
                (pdir / "CHANGELOG.md").write_text(
                    f"# Changelog — {name}\n\n## {version} — GID baseline\n\n"
                    "- Initial standing-record entry.\n",
                    encoding="utf-8",
                )
                made.append("CHANGELOG.md")
            if made:
                return "created " + " + ".join(made)
    except OSError as exc:
        return f"FAILED ({exc})"
    return None


def score(checks: dict[str, bool]) -> tuple[int, dict[str, int]]:
    total = sum(10 for v in checks.values() if v)
    dims: dict[str, int] = {}
    for gid, _label, dim in CHECKS:
        dims[dim] = dims.get(dim, 0) + (10 if checks.get(gid) else 0)
    return max(1, min(100, total)), dims


def last_scores(path: Path = STANDINGS_JSONL) -> dict[str, int]:
    prev: dict[str, int] = {}
    if not path.is_file():
        return prev
    try:
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("name") is not None and rec.get("score") is not None:
                prev[rec["name"]] = int(rec["score"])
    except OSError:
        pass
    return prev


def render_standings(records: list[dict], path: Path = STANDINGS_MD) -> None:
    ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    rows = sorted(records, key=lambda r: (-r["score"], r["name"]))
    band = lambda s: (
        "shippable" if s >= 90 else "credible" if s >= 70
        else "gappy" if s >= 40 else "scaffold"
    )
    scores = sorted(r["score"] for r in rows)
    n = len(scores)
    mean = sum(scores) / n if n else 0
    median = scores[n // 2] if n else 0
    ship = sum(1 for s in scores if s >= 90)
    gaps = sum(len(r.get("open_gaps", [])) for r in rows)
    dims: dict[str, list[int]] = {}
    for r in rows:
        for d, v in (r.get("dims") or {}).items():
            dims.setdefault(d, []).append(v)
    dimline = ", ".join(
        f"{d} {sum(v) / len(v):.1f}/20" for d, v in sorted(dims.items())
    )
    lines = [
        "# GID Standings",
        "",
        f"Last run: {ts}. Scores 1–100 per `rubric.md`. Best first.",
        "",
        f"Lab as a whole: {n} products, mean {mean:.1f}, median {median}, "
        f"{ship}/{n} shippable (>=90), "
        f"{gaps} open gap{'s' if gaps != 1 else ''}.",
        f"Dimension means: {dimline}." if dimline else "",
        "",
        "| Rank | Product | Score | Band | Δ vs last | Open gaps | Fixes applied |",
        "|-----:|---------|------:|------|----------:|-----------|---------------|",
    ]
    for i, r in enumerate(rows, 1):
        d = r.get("delta")
        dstr = "—" if d is None else (f"+{d}" if d > 0 else str(d))
        gaps = ", ".join(r.get("open_gaps", [])) or "none"
        fixes = "; ".join(r.get("fixes_applied", [])) or "—"
        lines.append(
            f"| {i} | {r['name']} | {r['score']} | {band(r['score'])} "
            f"| {dstr} | {gaps} | {fixes} |"
        )
    lines += ["", "_Generated by `gid.py`. Do not hand-edit; re-run GID._", ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="GID betterment loop runner")
    ap.add_argument("--score-only", action="store_true",
                    help="score and record, apply no fixes")
    ap.add_argument("--no-fix", action="store_true",
                    help="audit mode: no fixes, still records standings")
    ap.add_argument("--product", default=None, help="run one product only")
    ap.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    ap.add_argument("--root", default=str(DEFAULT_ROOT))
    args = ap.parse_args(argv)

    registry = Path(args.registry)
    root = Path(args.root)
    if not registry.is_file():
        print(f"registry not found: {registry}", file=sys.stderr)
        return 2
    try:
        products = json.loads(registry.read_text(encoding="utf-8"))["products"]
    except (json.JSONDecodeError, KeyError, OSError) as exc:
        print(f"bad registry: {exc}", file=sys.stderr)
        return 2

    all_names = {p["name"] for p in products}
    if args.product:
        products = [p for p in products if p.get("name") == args.product]
        if not products:
            print(f"unknown product: {args.product}", file=sys.stderr)
            return 2

    apply_fixes = not (args.score_only or args.no_fix)
    prev = last_scores()
    run_ts = _dt.datetime.now(_dt.timezone.utc).isoformat()
    run_records: list[dict] = []

    for p in products:
        name = p["name"]
        pdir = root / p["path"]
        if not pdir.is_dir():
            checks = {gid: False for gid, _, _ in CHECKS}
            gaps = ["missing-dir:" + p["path"]]
            run_records.append({
                "ts": run_ts, "name": name, "path": p["path"],
                "score": 1, "dims": {}, "open_gaps": gaps,
                "fixes_applied": [],
                "delta": 1 - prev[name] if name in prev else None,
            })
            print(f"{name:22s} MISSING DIR -> 1")
            continue
        focus = p.get("focus")
        prefer_cargo = bool(focus) and any(
            str(s).endswith(".rs") for s in focus
        )
        mname, manifest, mdir = find_manifest(pdir, root, prefer_cargo)
        manifest_file = (mdir / mname) if (mdir and mname) else None
        if not isinstance(manifest, dict):
            manifest = {}
        checks = check_product(pdir, manifest, root, manifest_file, focus)
        fixes_applied: list[str] = []
        # Focus entries share their directory with other modules: audit-grade
        # only, never write stubs into a shared dir.
        can_write = not focus
        # License stubs must match the owning tree: lab dual-license vs
        # psi commercial — never mix them.
        try:
            commercial = not pdir.resolve().is_relative_to(root.resolve())
        except OSError:
            commercial = False
        if apply_fixes and can_write:
            for gid, _, _ in CHECKS:
                if not checks[gid] and gid in SAFE_FIXABLE:
                    msg = safe_fix(pdir, gid, manifest, commercial)
                    if msg and not msg.startswith("FAILED"):
                        fixes_applied.append(f"{gid}: {msg}")
            checks = check_product(pdir, manifest, root, manifest_file, focus)  # re-score post-fix
        s, dims = score(checks)
        open_gaps = [gid for gid, _, _ in CHECKS if not checks[gid]]
        steps = []
        for g in open_gaps:
            note = FIX_GUIDANCE[g]
            if focus and g in SAFE_FIXABLE:
                note += " (shared dir: stub not auto-written; fix at owning-project level)"
            steps.append(f"{g}: {note}")
        rec = {
            "ts": run_ts, "name": name, "path": p["path"],
            "score": s, "dims": dims, "open_gaps": open_gaps,
            "fixes_applied": fixes_applied,
            "next_steps": steps,
            "delta": s - prev[name] if name in prev else None,
        }
        if focus:
            rec["focus"] = focus
        if manifest_file is not None:
            rec["manifest"] = str(manifest_file)
        run_records.append(rec)
        flag = " (fixed: %s)" % "; ".join(fixes_applied) if fixes_applied else ""
        print(f"{name:22s} {s:3d}  gaps={open_gaps or ['none']}{flag}")

    if not args.product:
        # full-run standings table covers all registry products
        table_records = run_records
    else:
        # single-product run: merge with latest full standings for context
        table_records = run_records
    try:
        with STANDINGS_JSONL.open("a", encoding="utf-8") as fh:
            for r in run_records:
                fh.write(json.dumps(r) + "\n")
        # STANDINGS.md reflects latest score per product across history.
        # Retired registry names drop off the table (their history stays
        # in the append-only log). all_names is the full registry even
        # on single-product runs.
        active = all_names
        latest: dict[str, dict] = {}
        for line in STANDINGS_JSONL.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    r = json.loads(line)
                    if r["name"] in active:
                        latest[r["name"]] = r
                except json.JSONDecodeError:
                    continue
        render_standings(list(latest.values()))
    except OSError as exc:
        print(f"standings write failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
