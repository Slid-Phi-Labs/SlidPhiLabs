# CuNi — development

Updated 2026-11-02. Source: psi goals.md, standing memory, STATUS.md.

- cuni 0.10.0 built; seed EXACT on 2 seats.
- Conductor: `npm test` (13), direct-serve harness in /tmp, needs CUNI_BIN.
- Active goal: Conductor demo fully reproducible on user machine
  (needs user-side wrangler run). Open, not done.
- Studio host suspended ($0). intune v5 bench history on file.
- Next milestone: user-side run green → goal checked → ledger updated.

## History

- 2026-08-31: SoT 1.18.0 puts CuNi on every public page.
- 2026-09-09: protocol published + sitemap; catalog 0.1.8.
- 2026-09-11: 0.1.9 drift fix. 2026-09-14: agent skills.
- 2026-10-07: SEO rewrites. 2026-10-28: 0.10.0, seed EXACT.
- intune arc: reps + parse built, frame v5, full bench pending user run.

- 2026-11-26 (Muse unfinished): attempted CuNi EXEC unblock — host has rustc
  1.99 + llvm-mingw gcc, but MSVC `link.exe` missing and windows-gnu link fails
  (`-lgcc_eh`/`-lgcc`). Arms stay honest 96 blocked. Conductor API tests green
  without CUNI_BIN; see development/conductor-repro.md.


- 2026-11-26 eve (GID close-out, second session):
  - cuni: 85 -> 100 (real Usage + CHANGELOG + package-lock; suite 2/2).
  - cuni-api: 85 -> 100 (real Usage + CHANGELOG + package-lock; suite 1/1).
  - cuni-parse: 86 -> 96 (real Usage + CHANGELOG; EXEC stays blocked, linker absent).
  - site modules x4: 85 -> 100 (shared README with executed examples + CHANGELOG in api/lib + docs/site package-lock).
  - psi-persist, psi-interlink: 95 -> 100 (requirements pins in ~/psi).
  - New depth products: rider-api 70->100, lab-sdk 65->100, lab-db 60->100, site 60->100 (all verified suites + re-scores).

