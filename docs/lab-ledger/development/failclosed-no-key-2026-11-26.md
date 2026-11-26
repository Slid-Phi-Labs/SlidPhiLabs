# Fail-closed `no_key` → 503 — 2026-11-26

TOP100 #45. Local evidence only. No Stripe spend. No Fly deploy.

## Handlers

- `docs/site/api/hq.js`: `stripeKey()` empty → `{ ok:false, reason:"no_key" }`; create maps `no_key` → **503** (else 502).
- `docs/site/api/billing-portal.js`: missing key → **503** `{ error:"stripe_not_configured" }`.

## Tests (green)

```text
cd docs/site/api
node --test hq.test.mjs billing-portal.test.mjs
# ✔ create with valid input but no Stripe key fails closed, no charge
#   assert statusCode === 503 && reason === "no_key"
# ✔ portal: bad id 400, no key 503, one-time purchase 409
# 10 pass / 0 fail
```

## Verdict

Already fail-closed. Mark #45 DONE. No muse-owned API fix required.
