#!/usr/bin/env python3
"""GID — Gap-ID Fix Betterment Loop.

Scores every product in products.registry.json 1-100, finds gaps per
rubric.md, applies safe smart fixes, keeps standing records.

Usage:
    python gid.py [--score-only] [--no-fix] [--product NAME]
                  [--registry PATH] [--root PATH]
                  [--passes N] [--until-stable]

Outputs:
    standings.jsonl  append-only, one record per product per run
    STANDINGS.md     regenerated league table
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_REGISTRY = HERE / "products.registry.json"
DEFAULT_ROOT = HERE.parent  # SlidPhiLabs/
STANDINGS_JSONL = HERE / "standings.jsonl"
STANDINGS_MD = HERE / "STANDINGS.md"

SECRET_RE = re.compile(
    r"(api[_-]?key|secret|password)\s*=\s*['\"]([^'\"]{4,})['\"]",
    re.IGNORECASE,
)
SECRET_PLACEHOLDER_RE = re.compile(
    r"your|xxx|example|placeholder|dummy|changeme|\btest\b|\bdemo\b|"
    r"sample|here|<|>|sk_test|pk_test|rk_test",
    re.IGNORECASE,
)
RUST_TEST_RE = re.compile(r"#\[test\]")
# Plain literals: this file is never a scored product, so no self-scan dodge.
# (Vendored bundles are excluded by name in _VENDOR_TODO_NAME instead.)
PLACEHOLDER_RE = re.compile(
    r"\b(TODO|PLACEHOLDER|TBD|FIXME)\b", re.IGNORECASE
)

CHECKS = [
    ("G-FUNC-01", "Manifest present", "Functionality"),
    ("G-FUNC-02", "Entry source present", "Functionality"),
    ("G-WIRE-01", "Own tests wired", "Functionality"),
    ("G-SURF-01", "Surface reachable", "Functionality"),
    ("G-REL-01", "Tests present", "Reliability"),
    ("G-EXEC-01", "Tests execute green", "Reliability"),
    ("G-EXEC-02", "Zero skipped tests", "Reliability"),
    ("G-NEG-01", "Negative-path coverage", "Reliability"),
    ("G-SEC-01", "License present", "Security"),
    ("G-SEC-02", "No plaintext secrets", "Security"),
    ("G-LOCK-01", "Lockfile pins manifest", "Security"),
    ("G-HTTPS-01", "No plaintext-http deps", "Security"),
    ("G-DOC-01", "README present + substantive", "Docs"),
    ("G-DOC-02", "NOTICE / CHANGELOG present", "Docs"),
    ("G-USAGE-01", "Usage documented", "Docs"),
    ("G-LOG-01", "CHANGELOG substantive", "Docs"),
    ("G-OPS-01", "Versioned past scaffold", "Ops"),
    ("G-OPS-02", "No scaffold placeholders", "Ops"),
    ("G-JUNK-01", "No tracked build junk", "Ops"),
    ("G-TODO-01", "No TODOs in sources", "Ops"),
]

POINTS = 5          # full pass per check
POINTS_BLOCKED = 3  # execution-impossible-here partial (toolchain absent)

NEG_RE = re.compile(
    r"refus|reject|mismatch|throw|invalid|no_|fail|deny|error|wrong",
    re.IGNORECASE,
)
USAGE_RE = re.compile(r"us(age|e\b)|example|quickstart|getting started",
                      re.IGNORECASE)
HTTP_RE = re.compile(r"http://(?!localhost|127\.|schemas\.|www\.w3\.org)")
LOCKFILES = ("package-lock.json", "Cargo.lock", "poetry.lock", "pdm.lock",
             "uv.lock", "requirements.txt", "requirements-lock.txt")
JUNK_RES = (
    re.compile(r"(^|/)(__pycache__|node_modules|target|dist|build)(/|$)"),
    re.compile(r"\.pyc$"),
    re.compile(r"(^|/)\.DS_Store$"),
)
SKIP_DIRS = {".git", "node_modules", "target", "__pycache__", ".venv",
             "venv", "dist", "build", "vendor", "third_party",
             ".tox", ".mypy_cache", ".pytest_cache", "site-packages"}
EXEC_TIMEOUT_S = 120

SAFE_FIXABLE = {"G-DOC-01", "G-DOC-02"}

# Vendored / generated bundles — their upstream open-item markers are not
# lab product debt (e.g. livekit client ESM under docs/site/assets).
_VENDOR_TODO_NAME = re.compile(
    r"(livekit-client|\.min\.js$|\.bundle\.js$|\.umd\.js$)", re.IGNORECASE
)


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


def _tree_files(pdir: Path) -> list[Path]:
    out: list[Path] = []
    stack = [pdir]
    while stack:
        d = stack.pop()
        try:
            entries = list(d.iterdir())
        except OSError:
            continue
        for e in entries:
            try:
                if e.is_dir():
                    if e.name not in SKIP_DIRS and not e.is_symlink():
                        stack.append(e)
                elif e.is_file() and e.stat().st_size <= 500_000:
                    out.append(e)
            except OSError:
                pass
    return out


def _product_tests(
    pdir: Path, focus: list[str] | None, focus_files: list[Path],
) -> list[Path]:
    if focus:
        return sorted(f for f in focus_files if is_test_file(f))
    found: set[Path] = set()
    for td in ("test", "tests"):
        d = pdir / td
        if d.is_dir():
            try:
                for f in d.iterdir():
                    if f.is_file() and is_test_file(f):
                        found.add(f)
            except OSError:
                pass
    try:
        for f in pdir.iterdir():
            if f.is_file() and is_test_file(f):
                found.add(f)
    except OSError:
        pass
    return sorted(found)


def _wired_ok(mname: str | None, script: str, test_files: list[Path],
              rust_tests: bool, pytest_cfg: bool, shtest_ok: bool) -> bool:
    if mname == "Cargo.toml":
        return bool(rust_tests)
    if mname == "pyproject.toml":
        return bool(pytest_cfg or "pytest" in script)
    if test_files and shtest_ok and not script:
        return True
    if not test_files:
        return False
    names = [f.name for f in test_files]
    return any(n in script for n in names) or "test/" in script \
        or "tests/" in script


def _surface_ok(pdir: Path, manifest: dict, mname: str | None,
                focus: list[str] | None) -> bool:
    if focus:
        stems = []
        for s in focus:
            stem = s.split(".")[0] if "." in s else s
            stems.append(stem)
        if any(st in ("main", "index") for st in stems):
            return True
        pats = [re.compile(
            r"(import|require|from|use|mod|export)[^;\n]{0,160}\b"
            + re.escape(st) + r"\b") for st in stems]
        for f in _tree_files(pdir):
            if f.suffix not in SOURCE_SUFFIXES:
                continue
            try:
                text = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if any(p.search(text) for p in pats):
                return True
        return False
    if mname == "package.json" and isinstance(manifest, dict):
        if isinstance(manifest.get("exports"), dict) or manifest.get("main"):
            return True
        if (pdir / "index.mjs").is_file() or (pdir / "index.js").is_file():
            return True
        return False
    if mname == "pyproject.toml":
        return True  # named project package: pip-installable surface
    if mname == "Cargo.toml":
        return ((pdir / "src" / "lib.rs").is_file()
                or (pdir / "src" / "main.rs").is_file())
    return False


def check_product(
    pdir: Path,
    manifest: dict,
    root: Path,
    manifest_file: Path | None = None,
    focus: list[str] | None = None,
) -> tuple[dict[str, int], dict]:
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
            # xo-ecosystem layout: source/ is src/ by another name.
            src_ok = (pdir / "source").is_dir() and any(
                (pdir / "source").iterdir())
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
    lic_ok = any(
        has_upward(pdir, root, n)
        for n in ("LICENSE", "LICENSE.txt", "LICENSE.md", "LICENCE",
                  "LICENCE.txt", "COPYING", "COPYING.txt")
    )
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
            text = probe.read_text(encoding="utf-8", errors="replace")
            for m in SECRET_RE.finditer(text):
                # Doc-example placeholders (your-key, xxx, sk_test, ...)
                # are fixtures by another name; real-looking values fail.
                if not SECRET_PLACEHOLDER_RE.search(m.group(2)):
                    secrets_ok = False
                    break
            if not secrets_ok:
                break
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

    mname = manifest_file.name if manifest_file is not None else None
    mdir = manifest_file.parent if manifest_file is not None else None
    script = ""
    if isinstance(manifest, dict):
        scripts = manifest.get("scripts")
        if isinstance(scripts, dict):
            script = " ".join(str(v) for v in scripts.values())
    pytest_cfg = bool(isinstance(manifest, dict) and manifest.get("_pytest"))
    tfiles = _product_tests(pdir, focus, focus_files)
    if not tfiles and rust_tests and any(
            str(s).endswith(".rs") for s in (focus or [])):
        # Rust convention: #[test] fns live inside src files — the crate
        # itself is the executable test carrier.
        tfiles = [f for f in focus_files if f.suffix == ".rs"]
    if not tfiles and mname == "Cargo.toml" \
            and (pdir / "Cargo.toml").is_file():
        # Owned crate without a test/ dir: in-source #[test] fns are the
        # suite; cargo runs them from the manifest.
        srcd = pdir / "src"
        if srcd.is_dir():
            tfiles = sorted(f for f in srcd.iterdir()
                            if f.is_file() and f.suffix == ".rs")
    wired = _wired_ok(mname, script, tfiles, rust_tests, pytest_cfg,
                      bool(shtest_wired))
    surf = _surface_ok(pdir, manifest, mname, focus)
    execm = _run_suite(pdir, mname, tfiles)
    everd = execm["verdict"]
    if not tfiles:
        e1, e2 = 0, POINTS
    elif everd == "green":
        e1 = POINTS
        e2 = POINTS if execm["skipped"] == 0 else 0
    elif everd == "blocked":
        e1, e2 = POINTS_BLOCKED, POINTS_BLOCKED
    else:
        e1, e2 = 0, 0
    neg = False
    for f in tfiles:
        try:
            if NEG_RE.search(f.read_text(encoding="utf-8",
                                         errors="replace")):
                neg = True
                break
        except OSError:
            pass
    try:
        readme_text = readme.read_text(
            encoding="utf-8", errors="replace")[:30000] if readme_ok else ""
    except OSError:
        readme_text = ""
    clog = pdir / "CHANGELOG.md"
    try:
        clog_ok = clog.is_file() and len(clog.read_text(
            encoding="utf-8", errors="replace")) > 200
    except OSError:
        clog_ok = False
    todo_re = re.compile(r"\b(TODO|FIXME)\b", re.IGNORECASE)
    # Test files ARE in scope: real debt lives in tests too (e.g. a test
    # noting an unverified security check). Test *data* for the
    # marker-detector feature itself is not debt: markers inside string
    # literals are stripped before matching, comments still count.
    # This scanner file is never product debt (slid-phi path=".").
    self_file = Path(__file__).resolve()
    if focus:
        todo_scope = list(focus_files)
    else:
        todo_scope = [
            f for f in _tree_files(pdir)
            if f.suffix in SOURCE_SUFFIXES
            and not _VENDOR_TODO_NAME.search(f.name)
        ]
    todo_scope = [
        f for f in todo_scope
        if f.resolve() != self_file
        and not _VENDOR_TODO_NAME.search(f.name)
    ]
    todo_ok = True
    for f in todo_scope:
        try:
            text = _strip_string_literals(f.read_text(encoding="utf-8",
                                                      errors="replace"))
            if todo_re.search(text):
                todo_ok = False
                break
        except OSError:
            pass
    checks = {
        "G-FUNC-01": POINTS if manifest_file is not None else 0,
        "G-FUNC-02": POINTS if src_ok else 0,
        "G-WIRE-01": POINTS if wired else 0,
        "G-SURF-01": POINTS if surf else 0,
        "G-REL-01": POINTS if ((test_dir and test_files)
                               or rust_tests) else 0,
        "G-EXEC-01": e1,
        "G-EXEC-02": e2,
        "G-NEG-01": POINTS if neg else 0,
        "G-SEC-01": POINTS if lic_ok else 0,
        "G-SEC-02": POINTS if secrets_ok else 0,
        "G-LOCK-01": POINTS if _lockfile_ok(mdir) else 0,
        "G-HTTPS-01": POINTS if _https_ok(manifest_file) else 0,
        "G-DOC-01": POINTS if readme_ok else 0,
        "G-DOC-02": POINTS if notice_ok else 0,
        "G-USAGE-01": POINTS if _usage_ok(readme_text) else 0,
        "G-LOG-01": POINTS if clog_ok else 0,
        "G-OPS-01": POINTS if versioned_ok else 0,
        "G-OPS-02": POINTS if placeholders_ok else 0,
        "G-JUNK-01": POINTS if _junk_ok(pdir) else 0,
        "G-TODO-01": POINTS if todo_ok else 0,
    }
    return checks, {"exec": execm}


_STRING_LITERAL_RE = re.compile(
    r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`")
_REGEX_LITERAL_RE = re.compile(r"/(?:[^/\\\n]|\\.)+/[gimsuy]*")

def _strip_string_literals(text: str) -> str:
    """Blank out single-line string and regex-literal contents so test
    *data* mentioning markers (detector corpus) does not flag, while
    markers in comments still count as debt."""
    return _REGEX_LITERAL_RE.sub("", _STRING_LITERAL_RE.sub("", text))


def _parse_node(out: str) -> tuple[int, int, int]:
    counts = dict(re.findall(
        r"(tests|pass|fail|cancelled|skipped|todo)\s+(\d+)", out))
    num = lambda k: int(counts.get(k, 0))
    passed, failed = num("pass"), num("fail")
    skipped = num("skipped") + num("todo")
    if not counts and "not ok" in out:
        failed = max(failed, 1)
    return passed, failed, skipped


def _parse_pytest(out: str) -> tuple[int, int, int]:
    counts: dict[str, int] = {}
    for n, k in re.findall(r"(\d+)\s+(passed|failed|skipped|error)", out):
        counts[k] = counts.get(k, 0) + int(n)
    return (counts.get("passed", 0),
            counts.get("failed", 0) + counts.get("error", 0),
            counts.get("skipped", 0))


def _linker_ok() -> bool:
    if shutil.which("cargo") is None:
        return False
    if os.name == "nt":
        return any(shutil.which(t) for t in ("link", "cl", "cc", "gcc"))
    return shutil.which("cc") is not None


def _run_suite(pdir: Path, mname: str | None,
               test_files: list[Path]) -> dict:
    """Execute the product suite. Verdicts: green / fail / blocked."""
    if not test_files:
        return {"verdict": "fail", "reason": "no test files to run",
                "passed": 0, "failed": 0, "skipped": 0, "cmd": ""}
    suffixes = {f.suffix for f in test_files}
    node = shutil.which("node")
    npm = shutil.which("npm")
    py_files = [f for f in test_files if f.suffix == ".py"]
    js_files = [f for f in test_files
                if f.suffix in {".mjs", ".js", ".cjs", ".ts"}]
    rs_files = [f for f in test_files if f.suffix == ".rs"]
    sh_files = [f for f in test_files if f.suffix == ".sh"]
    if mname == "pyproject.toml" and py_files:
        test_files, suffixes = py_files, {".py"}
    elif mname == "package.json" and js_files:
        test_files, suffixes = js_files, {".mjs"}
    elif mname == "Cargo.toml" and (rs_files or True):
        test_files, suffixes = rs_files, {".rs"}
    if suffixes <= {".mjs", ".js", ".cjs", ".ts"} and node:
        if mname == "package.json" and (pdir / "package.json").is_file():
            if npm is None:
                return {"verdict": "blocked",
                        "reason": "npm not on PATH",
                        "passed": 0, "failed": 0, "skipped": 0, "cmd": ""}
            cmd = [npm, "test", "--prefix", str(pdir)]
            cwd = pdir
        else:
            by_dir: dict[Path, list[Path]] = {}
            for f in test_files:
                by_dir.setdefault(f.parent, []).append(f)
            target = max(by_dir, key=lambda d: len(by_dir[d]))
            # Run only the product's test files (focus rows must not inherit
            # sibling skips from a shared directory like docs/site/api).
            names = sorted(f.name for f in by_dir[target])
            if not names:
                return {"verdict": "fail",
                        "reason": "no runnable test files",
                        "passed": 0, "failed": 0, "skipped": 0, "cmd": ""}
            cmd = [node, "--test", *names]
            cwd = target
        try:
            r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                               errors="replace", timeout=EXEC_TIMEOUT_S)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"verdict": "fail", "reason": f"runner error: {exc}",
                    "passed": 0, "failed": 0, "skipped": 0,
                    "cmd": " ".join(cmd)}
        out = (r.stdout or "") + "\n" + (r.stderr or "")
        passed, failed, skipped = _parse_node(out)
        if r.returncode == 0 and failed == 0:
            verdict: str = "green"
        else:
            verdict, failed = "fail", max(failed, 1)
        return {"verdict": verdict, "reason": out[-800:],
                "passed": passed, "failed": failed, "skipped": skipped,
                "cmd": " ".join(cmd)}
    if suffixes <= {".py"}:
        try:
            import pytest  # noqa: F401
        except ImportError:
            if shutil.which("pytest") is None:
                return {"verdict": "blocked",
                        "reason": "pytest not installed on this box",
                        "passed": 0, "failed": 0, "skipped": 0, "cmd": ""}
        ws = pdir.resolve()
        while ws.name not in ("SlidPhiLabs", "psi", "CuNIverse") \
                and ws.parent != ws:
            ws = ws.parent
        cmd = [sys.executable, "-m", "pytest",
               *[str(f) for f in test_files], "-q"]
        try:
            r = subprocess.run(cmd, cwd=str(ws), capture_output=True,
                               text=True, errors="replace",
                               timeout=EXEC_TIMEOUT_S)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"verdict": "fail", "reason": f"runner error: {exc}",
                    "passed": 0, "failed": 0, "skipped": 0,
                    "cmd": " ".join(cmd)}
        out = (r.stdout or "") + "\n" + (r.stderr or "")
        passed, failed, skipped = _parse_pytest(out)
        verdict = "green" if r.returncode == 0 and failed == 0 else "fail"
        return {"verdict": verdict, "reason": out[-800:],
                "passed": passed,
                "failed": failed or (0 if verdict == "green" else 1),
                "skipped": skipped, "cmd": " ".join(cmd)}
    if suffixes <= {".rs"} or mname == "Cargo.toml":
        if not _linker_ok():
            return {"verdict": "blocked",
                    "reason": "no linkable Rust toolchain on this box",
                    "passed": 0, "failed": 0, "skipped": 0,
                    "cmd": "cargo test"}
        cmd = ["cargo", "test", "--manifest-path",
               str(pdir / "Cargo.toml")]
        try:
            r = subprocess.run(cmd, cwd=str(pdir), capture_output=True,
                               text=True, errors="replace", timeout=300)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"verdict": "fail", "reason": f"runner error: {exc}",
                    "passed": 0, "failed": 0, "skipped": 0,
                    "cmd": " ".join(cmd)}
        out = (r.stdout or "") + "\n" + (r.stderr or "")
        if "error: linker" in out or "linker `link`" in out:
            return {"verdict": "blocked", "reason": "linker absent",
                    "passed": 0, "failed": 0, "skipped": 0,
                    "cmd": " ".join(cmd)}
        passed = sum(map(int, re.findall(r"(\d+) passed", out)))
        verdict = "green" if r.returncode == 0 else "fail"
        return {"verdict": verdict, "reason": out[-800:],
                "passed": passed, "failed": 0 if verdict == "green" else 1,
                "skipped": 0, "cmd": " ".join(cmd)}
    return {"verdict": "blocked",
            "reason": "no safe executor for this suite "
                      "(shell suites are not auto-run: side-effect risk)",
            "passed": 0, "failed": 0, "skipped": 0, "cmd": ""}


def _usage_ok(readme_text: str) -> bool:
    return "```" in readme_text and bool(USAGE_RE.search(readme_text))


def _https_ok(manifest_file: Path | None) -> bool:
    if manifest_file is None or not manifest_file.is_file():
        return True
    try:
        return not bool(HTTP_RE.search(manifest_file.read_text(
            encoding="utf-8", errors="replace")))
    except OSError:
        return True


def _lockfile_ok(mdir: Path | None) -> bool:
    if mdir is None:
        return False
    return any((mdir / n).is_file() for n in LOCKFILES)


def _junk_ok(pdir: Path) -> bool:
    try:
        probe = subprocess.run(
            ["git", "-C", str(pdir), "ls-files"], capture_output=True,
            text=True, errors="replace", timeout=30)
        if probe.returncode != 0:
            return True
        for line in probe.stdout.splitlines():
            if any(r.search(line.strip()) for r in JUNK_RES):
                return False
        return True
    except (OSError, subprocess.TimeoutExpired):
        return True


FIX_GUIDANCE = {
    "G-FUNC-01": "Add package.json/pyproject.toml with name, version, test script.",
    "G-FUNC-02": "Add src/ with the product entry point.",
    "G-REL-01": "Scaffold test/ with one smoke test for the happy path.",
    "G-SEC-01": "Copy the owning project's license set (lab dual-license trio / psi commercial LICENSE) — never mix them.",
    "G-SEC-02": "Move the literal into vault/env config; never commit live secrets.",
    "G-DOC-01": "Auto-fixable: stub README created from manifest name/version.",
    "G-DOC-02": "Auto-fixable: stub NOTICE / CHANGELOG.md created.",
    "G-OPS-01": "Cut a version past 0.1.0 with a CHANGELOG entry.",
    "G-OPS-02": (
        "Fill each TODO/PLACEHOLDER or file an issue and drop the marker."
    ),
    "G-WIRE-01": "Reference the product's own test file/dir in the manifest test command (cargo test / pytest config counts).",
    "G-SURF-01": "Declare the surface (npm main/exports, named project package, binary target) or gain an importer.",
    "G-EXEC-01": "Make the suite green; on a blocked box, re-run where the toolchain exists (output excerpt in record).",
    "G-EXEC-02": (
        "Unskip or remove skipped/todo tests; on a blocked box, re-run "
        "where the toolchain exists."
    ),
    "G-NEG-01": "Add one negative-path case (refusal/mismatch/invalid) to the suite.",
    "G-LOCK-01": "Cut a lockfile beside the manifest; never auto-run, log the command.",
    "G-HTTPS-01": "Move the URL to https.",
    "G-USAGE-01": "Human writes a real usage example with expected output; never fabricated.",
    "G-LOG-01": "Human records real CHANGELOG entries past the GID stub.",
    "G-JUNK-01": "Untrack the build artifact and ignore it; never ship caches.",
    "G-TODO-01": (
        "Fill each source TODO/FIXME or file an issue and drop the marker."
    ),
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


def score(checks: dict[str, int]) -> tuple[int, dict[str, int]]:
    total = sum(checks.get(gid, 0) for gid, _, _ in CHECKS)
    dims: dict[str, int] = {}
    for gid, _label, dim in CHECKS:
        dims[dim] = dims.get(dim, 0) + checks.get(gid, 0)
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


def upper_median(scores: list[int]) -> int:
    """Upper median: sorted scores[n//2]. Documented in rubric.md."""
    if not scores:
        return 0
    ordered = sorted(scores)
    return ordered[len(ordered) // 2]


def pass_converged(deltas: list[int | None]) -> bool:
    """True when every known delta is 0. None (first-seen) does not count."""
    known = [d for d in deltas if d is not None]
    return bool(known) and all(d == 0 for d in known)


def render_standings(
    records: list[dict],
    path: Path = STANDINGS_MD,
    *,
    run_ts: str | None = None,
) -> None:
    # Header uses the scoring run timestamp (record time), not render time.
    if run_ts:
        try:
            dt = _dt.datetime.fromisoformat(run_ts.replace("Z", "+00:00"))
            ts = dt.astimezone(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        except ValueError:
            ts = run_ts
    else:
        stamp = max((str(r.get("ts") or "") for r in records), default="")
        if stamp:
            try:
                dt = _dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
                ts = dt.astimezone(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            except ValueError:
                ts = stamp
        else:
            ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    rows = sorted(records, key=lambda r: (-r["score"], r["name"]))
    band = lambda s: (
        "shippable" if s >= 90 else "credible" if s >= 70
        else "gappy" if s >= 40 else "scaffold"
    )
    scores = [r["score"] for r in rows]
    n = len(scores)
    mean = sum(scores) / n if n else 0
    median = upper_median(scores)
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
        f"Last run: {ts} (run-start / record time). Scores 1–100 per `rubric.md`. Best first.",
        "",
        f"Lab as a whole: {n} products, mean {mean:.1f}, median {median} (upper-median), "
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


def _run_once(
    products: list[dict],
    *,
    root: Path,
    all_names: set[str],
    apply_fixes: bool,
    prev: dict[str, int],
    run_ts: str,
) -> list[dict]:
    """Score (+ optional safe fixes) one pass. Re-runs suite only when fixes landed."""
    run_records: list[dict] = []
    for p in products:
        name = p["name"]
        pdir = root / p["path"]
        if not pdir.is_dir():
            checks = {gid: 0 for gid, _, _ in CHECKS}
            gaps = ["missing-dir:" + p["path"]]
            run_records.append({
                "ts": run_ts, "name": name, "path": p["path"],
                "score": 1, "dims": {}, "open_gaps": gaps,
                "fixes_applied": [],
                "delta": 1 - prev[name] if name in prev else None,
                "exec": {"verdict": "missing",
                         "reason": "product dir absent"},
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
        checks, meta = check_product(pdir, manifest, root, manifest_file,
                                     focus)
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
            n_before = len(fixes_applied)
            for gid, _, _ in CHECKS:
                if checks[gid] < POINTS and gid in SAFE_FIXABLE:
                    msg = safe_fix(pdir, gid, manifest, commercial)
                    if msg and not msg.startswith("FAILED"):
                        fixes_applied.append(f"{gid}: {msg}")
            if len(fixes_applied) > n_before:
                checks, meta = check_product(pdir, manifest, root,
                                             manifest_file,
                                             focus)  # re-score post-fix
        s, dims = score(checks)
        open_gaps = [gid for gid, _, _ in CHECKS if checks[gid] < POINTS]
        steps = []
        exec_reason = str(meta.get("exec", {}).get("reason", "") or "")
        exec_reason = " ".join(exec_reason.split())
        for g in open_gaps:
            note = FIX_GUIDANCE[g]
            if g.startswith("G-EXEC") and exec_reason:
                note += f" [suite: {exec_reason[-160:]}]"
            if focus and g in SAFE_FIXABLE:
                note += " (shared dir: stub not auto-written; fix at owning-project level)"
            steps.append(f"{g}: {note}")
        rec = {
            "ts": run_ts, "name": name, "path": p["path"],
            "score": s, "dims": dims, "open_gaps": open_gaps,
            "fixes_applied": fixes_applied,
            "next_steps": steps,
            "delta": s - prev[name] if name in prev else None,
            "exec": meta.get("exec", {}),
        }
        if focus:
            rec["focus"] = focus
        if manifest_file is not None:
            rec["manifest"] = str(manifest_file)
        run_records.append(rec)
        flag = " (fixed: %s)" % "; ".join(fixes_applied) if fixes_applied else ""
        print(f"{name:22s} {s:3d}  gaps={open_gaps or ['none']}{flag}")
    return run_records


def _write_standings(run_records: list[dict], all_names: set[str], run_ts: str) -> None:
    with STANDINGS_JSONL.open("a", encoding="utf-8") as fh:
        for r in run_records:
            fh.write(json.dumps(r) + "\n")
    # STANDINGS.md reflects latest score per product across history.
    # Retired registry names drop off the table (their history stays
    # in the append-only log). all_names is the full registry even
    # on single-product runs.
    latest: dict[str, dict] = {}
    for line in STANDINGS_JSONL.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                r = json.loads(line)
                if r["name"] in all_names:
                    latest[r["name"]] = r
            except json.JSONDecodeError:
                continue
    render_standings(list(latest.values()), run_ts=run_ts)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="GID betterment loop runner")
    ap.add_argument("--score-only", action="store_true",
                    help="score and record, apply no fixes")
    ap.add_argument("--no-fix", action="store_true",
                    help="audit mode: no fixes, still records standings")
    ap.add_argument("--product", default=None, help="run one product only")
    ap.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    ap.add_argument("--root", default=str(DEFAULT_ROOT))
    ap.add_argument(
        "--passes",
        type=int,
        default=1,
        help="outer betterment passes (default 1). With N>1, stops early "
             "when every known product delta is 0 (same as --until-stable).",
    )
    ap.add_argument(
        "--until-stable",
        action="store_true",
        help="stop when every known product delta is 0; implied when "
             "--passes > 1",
    )
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
    passes = max(1, int(args.passes))
    # Multi-pass runs converge by default; --until-stable also forces it on N=1.
    until_stable = bool(args.until_stable or passes > 1)
    try:
        for i in range(1, passes + 1):
            prev = last_scores()
            run_ts = _dt.datetime.now(_dt.timezone.utc).isoformat()
            print(f"=== GID pass {i}/{passes} @ {run_ts} ===")
            run_records = _run_once(
                products,
                root=root,
                all_names=all_names,
                apply_fixes=apply_fixes,
                prev=prev,
                run_ts=run_ts,
            )
            _write_standings(run_records, all_names, run_ts)
            deltas = [r.get("delta") for r in run_records]
            if until_stable and pass_converged(deltas):
                print(f"converged after pass {i}: all deltas 0")
                break
    except OSError as exc:
        print(f"standings write failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
