# `api/lib` — site API modules

One module per file, each with a co-located `*.test.mjs` exercised by
`npm test` from `docs/site/` (`node --test` over the enumerated files).

Conventions:

- Fail-closed billing and auth: unknown callers get the free tier or a
  refusal, never an exception that leaks state. See
  [`usage-meter.mjs`](usage-meter.mjs) (byte metering, HMAC-bound
  per-day IP identities, raw IP never touches disk) and
  [`persisted-registry.mjs`](persisted-registry.mjs) (surviving registry).
- Money paths record first: every paid action lands in the sales ledger
  before it executes.
- Tests stay hermetic: disk-touching tests redirect `AUTH_DIR` to a temp
  dir, identity tests pass explicit `{ secret, day }` opts, and no test
  hits the network.

Run one module's suite with `node --test api/lib/<name>.test.mjs` from
`docs/site/`.
