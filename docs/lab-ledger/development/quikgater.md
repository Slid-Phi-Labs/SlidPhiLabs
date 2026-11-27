# Quikgater — development

Updated 2026-11-26. Source: `docs/site/pricing.json`, `/quikgater`, TOP100 #58.

## Decision (TOP100 #58) — keep named face; do not archive

**Quikgater stays a named product face.** It is thin (pay-per-fetch worker + status JSON) but live and priced — not a zombie name and not archived.

- **What:** Agent web fetch with x402. Unpaid URL → HTTP 402; paid on Base → worker returns the page; hard pages go to Fly render.
- **Price (canonical `pricing.json`):** `$0.02` per fetch; first **100** fetches/month free; customer-set monthly cap (default **$10**), alert at 80%. SKU `quikgater`.
- **Live:** worker `https://quikgater-worker.ceedotrock.workers.dev/` · page `/quikgater` · status `/api/quikgater` · wiki `/wiki/quikgater`.
- **Why keep:** Price book + public page + worker endpoint already exist; archive would create a false “ghost SKU” hole. Next work is paid-fetch E2E verify, not rename-or-kill.

## History

- 2026-11-26: TOP100 #58 — name-or-archive → **named face, metered, not archived**.
- 2026-08-20/25: named + priced in SoT, then quiet build history in-repo.
