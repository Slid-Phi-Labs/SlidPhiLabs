# GID Rubric — 1–100 (10 checks x 10 pts)

Single-module entries (`focus` in the registry) scope the file-based checks
to focus-matched files; manifest/license resolve upward to the owning
project. Focus entries are audit-grade: scored and gap-listed, never stub-written.

Scores clamp to 1–100. Each failed check opens one gap with a smart fix.

Language equivalents (same check, honest mapping): a top-level
importable/runnable module (single-file client, script) counts as entry
source without `src/`; `[tool.pytest.ini_options]` in `pyproject.toml`
counts as the wired test path for Python; a runnable `test-*.sh` /
`test-tools.sh` counts as the wired test path for shell-script dirs.
The plaintext-secret scan covers shipped files only — test fixtures
(dummy secrets in `*.test.*` / `test_*` files) are excluded.
Test files also include exact `test.*` basenames (`test.mjs`, `test.py`).
Rust: `#[test]` fns inside `src/*.rs` count as tests, and a `Cargo.toml`
plus present tests means `cargo test` is the wired test path. A
Rust-focused arm is owned by its crate manifest even when an npm
manifest sits beside it; `.rs` files count as entry sources.

## Functionality (20)

| Check | Gap ID | Pass when | Smart fix |
|-------|--------|-----------|-----------|
| Manifest present | G-FUNC-01 | `package.json` (or `pyproject.toml` / `Cargo.toml`) exists | `proposed`: scaffold manifest step logged |
| Entry source present | G-FUNC-02 | `src/` dir exists with at least one source file | `proposed`: entry-point scaffold step logged |

## Reliability (20)

| Check | Gap ID | Pass when | Smart fix |
|-------|--------|-----------|-----------|
| Tests present | G-REL-01 | `test/` or `tests/` dir with at least one test file | `proposed`: test scaffold command logged |
| Test script wired | G-REL-02 | Manifest defines a `test` script | `proposed`: add test-script snippet logged |

## Security (20)

| Check | Gap ID | Pass when | Smart fix |
|-------|--------|-----------|-----------|
| License present | G-SEC-01 | `LICENSE` file exists | `proposed`: copy from repo root `LICENSE`, logged |
| No plaintext secrets | G-SEC-02 | No `api[_-]?key\s*=\s*['\"][^'\"]+` / `secret\s*=` literals in repo-tracked config the product ships | `proposed`: move to vault/env, never auto-edited |

## Docs / UX (20)

| Check | Gap ID | Pass when | Smart fix |
|-------|--------|-----------|-----------|
| README present + substantive | G-DOC-01 | `README.md` exists and is > 500 chars | `safe`: create minimal stub from manifest name/version |
| NOTICE / CHANGELOG present | G-DOC-02 | `NOTICE` exists and (`CHANGELOG.md` exists) | `safe`: create stub `NOTICE` / `CHANGELOG.md` |

## Ops / Readiness (20)

| Check | Gap ID | Pass when | Smart fix |
|-------|--------|-----------|-----------|
| Versioned past scaffold | G-OPS-01 | Manifest version is not bare `0.1.0`, or a CHANGELOG exists | `proposed`: cut version + changelog entry, logged |
| No scaffold placeholders | G-OPS-02 | No `TODO` / `PLACEHOLDER` / `TBD` in manifest + README top 40 lines | `proposed`: fill-or-file-issue step logged |

## Score bands

- 90–100: shippable lead — fix remaining `proposed` gaps on sight
- 70–89: credible — safe fixes applied, schedule proposed work
- 40–69: gappy — needs a focused pass
- 1–39: scaffold — not reviewable yet
