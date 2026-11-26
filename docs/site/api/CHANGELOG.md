# Site API changelog

## 2026-11-26

- AgentHQ (`hq.js`): live Stripe Checkout create/activate; `session_used`
  returns 409 on reused Checkout sessions; status echoes `slug`.
- Wired live Price `price_1UfxcLLehTFD59CGBhLOr1Cl` / `spl_hq_month`.
- Dropped retired Checkout `payment_method_types` (Dashboard defaults).
- Tests: `hq.test.mjs` covers slug rules, checkout params, settings
  validation, fail-closed create, activate reuse, owner settings path.

## Earlier

- Hosted suite handlers (PCC, x402, billing, Rider, CuNi calls) continue
  under this directory; see individual `*.test.*` files for coverage.
