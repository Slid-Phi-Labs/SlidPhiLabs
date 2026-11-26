# CuNi Conductor — user-side reproducibility

Updated 2026-11-26 (Muse unfinished betterment). Goal from `development/cuni.md`:
Conductor demo fully reproducible on a user machine.

## What is already green here

Site API Conductor (no CuNi binary required):

```bash
cd docs/site/api
node --test conductor.test.js
node --test lib/conductor-tasks.test.mjs lib/conductor-review.test.mjs
```

Handlers: `conductor.js` → tasks + review + CI pipeline actions. Offline,
in-memory, fail-closed. Live route: `/api/conductor` on Fly when deployed.

## What still needs the user machine

Ledger blocker: **Conductor demo with live `CUNI_BIN` prove** is not
reproducible until:

1. User installs a linkable Rust toolchain (**MSVC Build Tools** with C++
   workload, or a complete mingw that provides `libgcc` — LLVM-MinGW alone
   failed here with `-lgcc_eh` / `-lgcc` missing).
2. `cargo test` / `cargo build --release` succeeds in `~/CuNIverse`.
3. `CUNI_BIN` points at the built `cuni` binary.
4. Optional: Wrangler/user-side worker run for Studio-shaped demos.

This box today: `rustc`/`cargo` present, but `link.exe` absent → GID marks
CuNiVerse arms **EXEC blocked (96)** honestly. Do not claim green prove
without a successful local `cargo test`.

## Minimal prove once CUNI_BIN exists

```bash
# after cargo build -p cuni --release (or workspace equivalent)
export CUNI_BIN=/path/to/cuni
# then product-specific prove / Conductor harness as documented in CuNIverse
```

## Next owner clicks

- Install VS Build Tools (C++) **or** a full mingw-w64 with libgcc, then
  re-run `python gid.py --product cuni-check` (expect 100 if suite green).
- Mark this ledger file done when a stranger machine reproduces without Muse help.
