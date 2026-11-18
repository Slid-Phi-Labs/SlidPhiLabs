# SOC 2 Type I readiness — current state and gaps

> Status: NOT certified. This page maps Trust Services Criteria to controls
> that exist today (with evidence pointers) versus work remaining, so a
> readiness assessor can quote accurately.

## Implemented (evidence in-repo or live)

| Criterion | Control | Evidence |
|---|---|---|
| CC6.1 / credential lifecycle | ES256 JWTs, 15m–24h TTL, fail-closed 400s on bad input | Agent-Rider `src/lib/rider.ts`, `OPERATOR_JOIN.md` |
| CC6.1 / revocation | kid revocation list in JWKS; permanent ends at revoke | `getJwks()`, `POST /api/rider/revoke` |
| CC6.1 / verification | Unknown/revoked kid refused; offline verifier must refuse | JWKS consumer contract in code comments |
| CC6.1 / least privilege | Self-service capped at L1; L2–L4 need merchant key | Issue route, operator docs |
| CC7.2 / monitoring | Append-only audit ledgers; renewal-chain revocation on reuse | `swarm.ts` ledger, `rider-renewal` selftest |
| CC7.3 / incident signals | Machine-readable refuse codes on every gate | `missing_rider`, `invalid_api_key`, `ttl_out_of_range` |
| A1.2 / change control | CI: dependabot, CodeQL, secret scan, SBOM/trivy advisory | `.github/` workflows (LAO Tier-1 baseline) |

## Gaps to close before a Type I audit

1. Written information-security policy + annual risk assessment (none published).
2. Vendor-management file for the 4 subprocessors (contracts, review dates).
3. Backups/restore test record for Supabase-backed seats.
4. Access-review cadence for operator-designated permanent agents and keys.
5. Incident-response runbook with named roles (today: one human inbox).
6. Penetration test or the in-progress Warrant/Chamber review letter on file.

Suggested sequence: close 1–2 (paper), run the independent review (in
progress), then engage an assessor for Type I with this page attached.
