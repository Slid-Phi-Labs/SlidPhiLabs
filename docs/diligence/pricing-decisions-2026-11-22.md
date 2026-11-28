# Pricing decisions — 2026-11-22

Branch: `muse/diligence-2026-11` (from `consistency-polish-2026-11-19`).
Decider: agent, under Corey's delegation to resolve every pricing conflict
grounded in realistic, comparable-industry pricing. No pricing question was
put to the owner. Anything that is a missing product fact rather than a
price is marked `[OWNER TO CONFIRM: …]`, not decided.

## Sources read (full text, 2026-11-22)

- `docs/site/pricing.json` in this checkout (read in full, including the
  `disputed` block) and its hand-synced mirror
  `docs/site/assets/pricing-data.mjs`.
- Live catalog: https://slidphilabs.fly.dev/api/x402-products (the current
  deploy; www.slidphilabs.com serves a stale 2026-11-13 build behind a DNS
  issue and was NOT used for prices).
- `docs/site/pricing.html`, `docs/site/products.html`, `docs/site/index.html`
  in this checkout (every price extracted).
- Live Merchant Gate offer: https://agentrider.fly.dev/ (homepage, read in
  full; the "MERCHANT GATE — BASE" block is on the homepage itself).
- Comparable vendor pricing pages, read in full on 2026-11-22 (see
  § Comparables). Used ONLY as a band check. No vendor price was copied.

## Decision 1 — Merchant Gate $11.99/mo vs Rider $12/$49/$199: DISTINCT products

Conflicting values:

- agentrider.fly.dev homepage: "MERCHANT GATE — BASE. Free for 7 days, then
  $11.99/month" — rider issuance API, L0–L4 clearance levels, unlimited free
  verification, self-describing 401s, 69 merchant-key status checks/month
  included, then $0.15 each. Stripe-billed.
- Main site / pricing.json / live catalog: Rider Solo $12/mo, Team $49/mo,
  Fleet $199/mo (identity seats with verification quotas: 500 / 5,000 /
  50,000 per month).

Decided: both stand. They are different products with different buyers and
different billing units, not two prices for one thing.

- Merchant Gate sells the ability to ISSUE riders: the buyer is a merchant
  who mints credentials for its own agents through a merchant key. Its meter
  is merchant-key status checks.
- Rider seats are the identities themselves plus a verification allowance:
  the buyer is an operator running agents. Its meter is verifications.
- The $0.01 gap ($11.99 vs $12.00) is noise, and $11.99 is live
  Stripe-billed copy on a separate deployed app. Changing a live billed price
  by one cent buys nothing and churns billing copy. It stays $11.99.

Boundary rule going forward: anything that issues riders under a merchant
key is Merchant Gate; anything that holds identities and verification quota
is a Rider seat. /pricing now carries a one-line pointer to Merchant Gate so
a reviewer sees the boundary instead of a contradiction.

Canonical Rider ladder (unchanged): Solo $12/mo, Team $49/mo,
Fleet $199/mo; annuals $120/$490/$1,990 (Decision 2).

Open item (not fixable from this branch): agentrider.fly.dev still brands
itself "Agent^Rider" and shows no Agent Rider Network name. Renaming that
surface is for whoever owns that deploy; nothing here deploys.

## Decision 2 — Rider annual prices on /pricing: YES, show them

Conflicting values: the annual SKUs ($120/$490/$1,990) exist in pricing.json
and are sold by the live catalog (rider-solo-year, rider-team-year,
rider-fleet-year), but /pricing showed monthly prices only, while rider.html
already showed both.

Decided: /pricing now shows the annuals in the Rider summary and price line
("Annual: Solo $120/yr · Team $490/yr · Fleet $1,990/yr (two months free)"
and "$12 – $199 / mo · $120 – $1,990 / yr").

Arithmetic (verified from pricing.json `math`): 12×$12=$144→$120;
12×$49=$588→$490; 12×$199=$2,388→$1,990. Uniform rule: annual = 10×
monthly, i.e. two months free, a 16.7% discount. The check script now
asserts this rule. The band check supports it: Clerk's annual billing is a
20% discount ($25→$20/mo) and Auth0's annual billing is ~8% off; 16.7% sits
inside the standard 10–20% SaaS annual-discount band. The Warrant add-on
annual ($80/yr) was also added to the /pricing Warrant line; the homepage
already stated it.

## Decision 3 — Rider plan periods on the homepage: every price states its period

Found: the homepage carousel slide already stated periods ("Solo $12/mo ·
Team $49/mo · Fleet $199/mo"), but the product card below it showed bare
numbers ("Solo $12 · Team $49 · Fleet $199").

Decided: the card now reads "Solo $12/mo · Team $49/mo · Fleet $199/mo".
No bare Rider price remains on the homepage. The check script asserts the
period-bearing string.

## Decision 4 — Lab Pass parts total: VERIFIED CORRECT, no page fix needed

Claim checked: "parts sum $650; the bundle is $495 (24% off)."

Recomputed from pricing.json: Chamber year $200 + Rider Solo year $120 +
PSI Meter 1 seat year $250 + Warrant add-on year $80 = $650. Bundle $495.
Discount = (650−495)/650 = 23.85%, stated as 24% off — correct rounding.
The live catalog blurb ("Parts $650; bundle $495"), /pricing, /products and
the homepage all state it identically. The check script now asserts the
parts-sum arithmetic from `math` keys so it cannot drift silently.

## Decision 5 — Rider Ops standalone price: the live catalog wins

Conflicting values:

- pricing.json `products.rider_ops` (before this change): "Fleet watch
  included in Rider Fleet. No standalone price." with empty `plans`.
- Live catalog: `rider-ops-month` $37.00 and `rider-ops-year` $369.00,
  both with Stripe links, blurbs ("Heartbeat + alert when a signed Rider
  agent goes quiet… Needs a Rider seat").

Decided: Rider Ops IS sold standalone at $37/mo / $369/yr. The catalog is
what actually charges, so it is the billing truth; the pricing.json note was
stale. pricing.json (and its hand-synced mirror pricing-data.mjs) now record
the standalone plans and prices, and the check script asserts them. No
catalog code was touched (Claude-owned path). Note the $369 annual is 10×
monthly minus $75 (37×12=$444→$369, a 16.9% discount) — consistent with
the annual-discount band, not the uniform 10× Rider rule; recorded as
observed, not harmonized.

## Decision 6 — TeachAid $9/mo "Pro": NOT canonical

Conflicting values: pricing.json's `disputed` block records a $9/mo Pro
figure in older holding files vs the $6/mo student price in pricing.json
`math`, the live catalog (teachaid-student $6.00/mo, teachaid-student-year
$60.00, teachaid-pilot $2,500/semester), and the live TeachAid billing
($0.99 trial, then $6/mo). No $9 SKU exists in the live catalog, and no
$9 price appears anywhere in the three pages checked in this checkout (the
disputed block's holding-file line numbers are stale).

Decided: the canonical TeachAid prices are student $6/mo, $60/yr, and the
institutional pilot $2,500 per campus per semester — the values pricing.json
and the live catalog agree on. The $9 figure is not presented as a price
anywhere by this change, and the `disputed` block in pricing.json is left
untouched (its governance reserves the tier question to the owner).

[OWNER TO CONFIRM: does a TeachAid Pro tier exist at all, and if so what
does it include beyond the student plan?] The check script continues to
exclude teachaid.html from price assertions.

## Decision 7 — PCC free window: lifetime-once-per-IP is canonical

Conflicting values: pricing.json `rule`, `suite`, and `products.pcc`
("first 1 GB free once per IP address (lifetime, no monthly reset)"),
/pricing (same wording), and the live catalog blurb ("First 1 GB free once
per IP") say lifetime; the `disputed` block lists pcc.html / wiki wording
saying monthly.

Decided: lifetime-once-per-IP is canonical — pricing.json and the live
catalog agree, and pricing.json is the stated source of truth. The
monthly-wording pages (pcc.html, wiki/pcc.html, .well-known files) are
outside this task's three pages and were NOT edited; correcting them is a
follow-up. The `disputed` block is left untouched.

## Decision 8 — Tollkeeper Toll 5 (exactness): NO canonical value

Conflicting values: products.html states "exactness $0.10" while other pages
state $0.05 (see pricing.json `disputed`). pricing.json deliberately
excludes Toll 5 from `products.tollkeeper`.

Decided: no value is canonical. Nothing in this change states a Toll 5
price, pricing.json still excludes it, and the check script still excludes
it.

[OWNER TO CONFIRM: is the Toll 5 exactness check $0.10 or $0.05 per check?]
products.html's $0.10 line was left as-is; harmonizing it before the owner
rules would present a disputed figure as fact.

### Resolution (Nov 28, 2026 — owner ruled $0.05)

Corey ruled $0.05 per check ("`.05 plz`", Nov 28, 2026). Applied the same
day, all local/unpushed: Toll 5 added to pricing.json
`products.tollkeeper` at $0.05 with `math.tollkeeper_toll_5_exactness`,
the `disputed` entry moved to a new top-level `resolved` record,
pricing-data.mjs hand-synced, check-prices.mjs assertions updated to
assert Toll 5 at $0.05 (guard passes), tollkeeper.html:88 and
products.html corrected to $0.05, EXACTNESS_SUBSTRATE.md corrected to
$0.05/check, and both Nov 22 decks re-rendered with the $0.05 figure
(cuni-deck-nov22 audit slide, slid-phi-labs-deck-nov22 CuNi slide).
The cuni-proof tool at $0.10 is a distinct metered tool and was NOT
changed. The two remaining disputed items (TeachAid tier, PCC
free-window) are untouched by this ruling.

## Other findings (recorded, not all decided)

1. PERsiST Solo annual is a deeper discount than the Rider rule:
   $13.31/mo vs $99/yr (12×$13.31=$159.72 → $99, a 38% discount). Both
   figures are explicit in pricing.json and no page contradicts them, so
   both stand as stated. Observation only.
2. PERsiST plans (psi-solo / psi-crew / psi-team SKUs in pricing.json)
   have no corresponding SKUs in the live catalog response read
   2026-11-22. Open item for Claude: catalog gap or retired plans.
3. Catalog-only SKUs with no pricing.json entry: sponsor $29, donate
   $29.99, Great Agentic Olympiad entry $1, shard-zip / shard-tsdb support
   $199. Not conflicts — the catalog sells more than pricing.json
   enumerates. The check script covers only prices stated on pages.
4. Catalog quirks for Claude (read-only findings, catalog code untouched):
   `psi-org`'s `human_stripe` points at `pay?sku=psi-team`, not psi-org;
   aliases `warrant-month` / `warrant-year` point at SKUs that do not exist
   (the SKUs are `warrant-addon` / `warrant-addon-year`); alias `chamber`
   resolves to `chamber-year`.
5. No legal footer exists on pricing.html in this checkout, and the
   homepage footer links Price list / Pricing / Checkout / MCP / Silesia /
   Wiki / About / Refunds only — no Terms or Privacy links. The brief's
   statement that a legal footer was already added could not be verified
   here; nothing was added or redone (legal drafts are a separate task).
6. Two garbled-character remnants were fixed on /pricing in the same edit:
   eight `Â·` mojibake kickers → `·`, and "default 2– plan price" → "default
   2× plan price" (pricing.json states "2x plan price").
7. Rename scope: "Agent Rider" → "Agent Rider Network" was applied to the
   three pages touched here (pricing.html, products.html, index.html) and
   to `products.rider.name` in pricing.json + pricing-data.mjs. Header
   names (X-Agent-Rider, X-Agent-Warrant), SKUs, aliases, routes, and
   file names were NOT renamed. Other pages (rider.html, wiki, llms.txt,
   api catalog titles) still say Agent-Rider; sweeping those is follow-up
   work, not done here.

## Implementation: check-only, no render-time wiring

The three pages are static HTML and the render path already has an
established pattern: pricing.json is the source, assets/pricing-data.mjs is
its hand-synced mirror, and scripts/check-prices.mjs guards both. Wiring
the pages to render prices from pricing.json at load time would touch the
verified carousel page and the established pattern for no reviewer-visible
gain. So this change extends the existing guard instead of rewiring: the
check now asserts the Rider annuals, the Merchant Gate pointer, the
homepage periods, the Lab Pass arithmetic, the 10× annual rule, the Rider
Ops SKUs, and the ARN name on the three touched pages. It passes:

`node docs/site/scripts/check-prices.mjs` → `check-prices: PASS
(58 canonical assertions, 68 math values, stale scan clean)`

## Comparables (band check only, full-text reads 2026-11-22)

| Vendor | What they charge for | Numbers read | Source |
|---|---|---|---|
| Clerk | Per retained user + per connection | Hobby free to 50,000 MRU/app; Pro $20/mo billed annually ($25 monthly); Business $250/mo billed annually; overage $0.02/MRU; extra SSO connection $75/mo; B2B add-on $100/mo | https://clerk.com/pricing |
| Auth0 | Per MAU tier | Free to 25,000 MAU; Essentials $35/mo (500 MAU); Professional $240/mo (500 MAU); M2M tokens 1,000 free (5,000 Pro); AI-identity add-ons for agents/MCP | https://auth0.com/pricing |
| WorkOS | Per MAU (free tier) + per connection | AuthKit free to 1M MAU, then $2,500/mo per extra 1M; SSO/Directory Sync $125/connection/mo (volume bands); Audit Logs $125/SIEM + $99 per 1M events; Radar first 1,000 checks free, then $100/mo per 50K checks | https://workos.com/pricing |
| Stripe | Per verification | Identity $1.50 per document+selfie verification; $0.50 per US SSN lookup; first 50 verifications free | https://stripe.com/pricing (Identity section) + https://stripe.com/identity |

What the band check concluded:

- ARN's $0.02/verification overage sits exactly on Clerk's $0.02/MRU
  overage rate: realistic for a metered check.
- ARN Solo $12/mo for 1 identity + 500 verifications is below Clerk Pro
  ($25) and Auth0 Essentials ($35), but those bill human MAU with hosted
  login UI; ARN bills one agent identity with local signature checks — a
  different unit with a lower cost basis. The ladder's per-identity price
  falls with volume ($12 → $4.90 → $1.99 per identity), which is the normal
  shape.
- Stripe's $1.50 human KYC check is a different product (document + selfie
  + third-party data), not a comparable for ARN's cryptographic
  verification; the 60× gap reflects cost basis, not mispricing.
- Annual = 10× monthly (16.7% off) sits inside the observed 8–20% band.
- The $495 bundle at ~24% off parts is a standard bundle discount.

## Open items for the owner (no price decision needed from Corey)

- [OWNER TO CONFIRM: does a TeachAid Pro tier exist?] (Decision 6)
- [RESOLVED Nov 28, 2026: $0.05 per check] Toll 5 exactness (Decision 8)
- Open items for Claude: PERsiST catalog SKUs (§ Other findings 2),
  catalog quirks (§ Other findings 4), remaining ARN rename sweep
  (§ Other findings 7), monthly-wording PCC pages (Decision 7).
- Nothing in this branch was pushed (org push returns 403 with the current
  token) or deployed. The branch carries the three unpushed
  consistency-polish commits underneath; the PR must note that.
