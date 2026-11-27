# Site API — AgentHQ and hosted handlers

Handlers under `docs/site/api/` serve the Slid Phi Labs site on Fly
(`spl-slidphilabs`). This README is the assurance surface for the
**AgentHQ** GID product (`hq.js`, `lib/hq-slug.mjs`, `hq.test.mjs`).

## AgentHQ (`hq.js`) — current usage

Humans claim at https://www.slidphilabs.com/hq. Agents/API hit
`/api/hq`. Money moves only through Stripe Checkout; records live under
`AUTH_DIR/hq/<slug>.json` (no separate DB). Fail closed: missing Stripe
key → `503 no_key`; unknown HQ → `404`; reused Checkout session →
`409 session_used`.

| Action | Method | Body / query | Result |
|--------|--------|--------------|--------|
| `status` | GET | `?name=` | `{ ok, exists, active }` |
| `create` | POST | `{ name, email }` | `{ ok, url, sessionId }` Checkout |
| `activate` | POST | `{ session_id }` | `{ ok, slug, managementToken, url }` |
| `settings` | GET/PATCH | `?name=` + Bearer token; PATCH `{ name, settings }` | owner settings |

```bash
# Status (unknown name → 404 unknown_hq)
curl -sS "https://www.slidphilabs.com/api/hq?action=status&name=demo"

# Create Checkout (needs Stripe key on server; no key → 503 no_key)
curl -sS -X POST "https://www.slidphilabs.com/api/hq?action=create" \
  -H "content-type: application/json" \
  -d '{"name":"aurora","email":"you@example.com"}'

# Activate after paid return (?paid=1&session_id=cs_…)
curl -sS -X POST "https://www.slidphilabs.com/api/hq?action=activate" \
  -H "content-type: application/json" \
  -d '{"session_id":"cs_live_…"}'

# Owner settings (Bearer = one-time management token from activate)
curl -sS "https://www.slidphilabs.com/api/hq?action=settings&name=aurora" \
  -H "authorization: Bearer <64-hex-token>"
```

Offer: **$29.99/mo** · Stripe product `spl_hq` · Price
`price_1UfxcLLehTFD59CGBhLOr1Cl` · lookup `spl_hq_month`. Checkout
params omit retired `payment_method_types` (Dashboard defaults).
Operator activate runbook: `/AGENTHQ-ACTIVATE.md`. Muse owns `hq.js` +
tests; Grok owns `hq.html` / discovery.

## Tests

```bash
cd docs/site/api
node --test hq.test.mjs
# expect 8/8 pass (no network; temp AUTH_DIR)
```

## License

Dual: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See `/LICENSE`.
