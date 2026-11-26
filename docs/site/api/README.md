# Site API — AgentHQ and hosted handlers

Handlers under `docs/site/api/` serve the Slid Phi Labs site on Fly
(`spl-slidphilabs`). This README is the assurance surface for the
**AgentHQ** GID product (`hq.js`, `hq-slug.mjs`, `hq.test.mjs`).

## AgentHQ usage

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
  -d '{"session_id":"cs_test_…"}'

# Owner settings (Bearer = one-time management token)
curl -sS "https://www.slidphilabs.com/api/hq?action=settings&name=aurora" \
  -H "authorization: Bearer <64-hex-token>"
```

Humans claim at https://www.slidphilabs.com/hq · $29.99/mo · Price
`price_1UfxcLLehTFD59CGBhLOr1Cl` (`spl_hq_month`). Operator activate
runbook: `/AGENTHQ-ACTIVATE.md`.

## Tests

```bash
cd docs/site/api
node --test hq.test.mjs
```

## License

Dual: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See `/LICENSE`.
