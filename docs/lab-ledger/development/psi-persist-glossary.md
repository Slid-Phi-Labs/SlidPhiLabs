# PSI vs PERsiST — naming glossary

Updated 2026-11-26. TOP100 #30. Canonical prices: `docs/site/pricing.json`. **Do not invent PERsiST rates.**

| Name | What it is | On sale? | Quote this |
|---|---|---|---|
| **PSI Meter** | Spend / call log seat for agents. SKU `psi-meter`. | Yes | **$25**/seat/mo or **$250**/seat/yr; 250k logged calls/mo then $2/100k; free tier 1 seat · 10k calls/mo · 7-day retention. Checkout `/pay?sku=psi-meter`. |
| **PSI Org** | Crew seat for the same spend log. SKU `psi-org`. | Yes | **$79**/mo. Checkout `/pay?sku=psi-org`. |
| **PSI Embed** | Commercial code license to ship psi closed (unified grant). SKU `psi-embed-grant`. | Yes (written grant) | **$490**/product/year (founding / 3+ schedule same as unified grant). Not an AGPL lane. |
| **psi (runtime)** | Licensed runtime tree: boot, doctor gate, observatory, retrieval scorer, savings meter. Public repo; **commercial seat only** since 2026-10-28. | Via Meter / Org / Embed | Pre-2026-10-28 AGPL copies stay AGPL; new use is commercial. |
| **PERsiST** | Persistent Super Intelligence product face: empty-start folded memory (`spl-heart`), session + token-saved billing model. Page `/persist`. | **Not on sale** | Billing shape: one fee per session + one fee per token saved. **Both rates unset** — checkout must not collect a PERsiST charge until both are in `pricing.json`. First 5,000 tokens/day folded free (no plan). |

## Confusion killers

- **PSI ≠ PERsiST.** Meter/Org/Embed are the sold seats. PERsiST is the empty-start memory product whose two rates are still unset.
- **Do not** map `persist` checkout aliases to a PERsiST fee. Catalog aliases that point `persist` → `psi-meter` sell the Meter seat, not a PERsiST rate.
- **Do not** invent per-session or per-token-saved dollars for PERsiST. Say “rates not set.”
- Link: ledger [psi.md](./psi.md) · site `/persist` · `/wiki/psi` · `/pricing`.
