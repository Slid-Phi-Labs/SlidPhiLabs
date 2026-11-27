# Changelog — @slidphi/lab-dashboard

## 2026-11-27 — Co-op lanes board

- L / OPEN / R board at `/lanes` (`lanes.mjs` store + claim/release/done
  endpoints, atomic tmp+rename writes, crew restricted to muse/tandem/grok).
- Seeded OPEN with 7 issues + 4 lab tasks; `LANES.md` records the shared
  borders. Suite now 8 pass (`lanes.test.mjs` covers claim/release/done
  fail-closed paths).

## 2026-11-26 — GID depth pass (new product)

- Declared the package (`package.json` + surface + wired `npm test`).
- Suite green: 2 pass / 0 fail. Cut `package-lock.json`.
- Documented real `Usage` with verified render output.

## 0.1.0 — GID baseline

- Initial standing-record entry.
