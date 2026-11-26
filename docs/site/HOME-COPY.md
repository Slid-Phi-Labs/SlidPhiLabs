# Slid Phi Labs — Home (copy source of truth)

**Hosting:** Fly app `slidphilabs` (`docs/site/`, deploys on push to `main`). Wix is retired; do not paste copy into Wix.
**Canonical site:** https://www.slidphilabs.com  
**Tagline:** Tools that check. Proof before praise. (Small label only, not the headline.)

**Homepage (Corey, 2026-11-24): the welcome page IS the homepage.** Greeting ("Welcome to Slid Phi Labs." / "Welcome, <first name>." when signed in), the 9-product carousel with links (Agent-Rider, Warrant, PERsiST, Chamber, CuNi, PCC, TRUSTREAM, AwLPay, TEACHAiD), then the mission (exact, bounded, receipted) and account / all-products buttons. No prices. /welcome shows the same page after sign-up. Previous headline (2026-11-21): "A name your agent can prove. A program that gives one answer."
**Brand art:** https://raw.githubusercontent.com/ceedot-rock/splabs-brand/main/assets/brand/slid-phi-labs-master.jpg  
**IP:** marketing + metrics only. No engine source, coefficients, or residual internals.  
**Design pack:** `docs/site/` — `index.html`, `try.html`, `access.html` (source of truth for layout + links).

---

## SEO (`index.html` head)

| Field | Value |
|--------|--------|
| **Title** | Slid Phi Labs — tools that check |
| **Description** | Slid Phi Labs: hosted lossless compression (PCC), signed agent identity (Rider), exact programs (CuNi), agent payments (AwLPay), and the TEACHAiD teaching campus. Proof before praise. |
| **Canonical** | https://www.slidphilabs.com/ |

---

## Nav

Home · Rider · CuNi · Warrant · Compress · Silesia · Wiki · Pricing

---

## Post-purchase banner

When Stripe lands on `/?purchase=PRODUCT` or `/?purchase=…&session=…`:

- Show toast: **Payment received** for {product} → **Go to Access**
- Access link: `/access?product={key}&session={id}` when session present

---

## Hero (restructured 2026-11-15, Corey: top is who we are / vision / mission, then products)

**Kicker:**
Slid Phi Labs · Cherry Hill, New Jersey

**H1:**
Tools that check.

**Lede (who we are):**
We are a computation and AI company. The cost of computing is the cost of everything now — data that takes too much room, agents that spend without proof, evidence that can't survive a dispute. We build the technology that removes those costs.

**Our vision:**
A machine-first world where every crossing is guarded: one conjoined encode-store-decode module, checked by agent oracles at every step, with exactness and receipts as primitives — not afterthoughts.

**Our mission:**
To make every claim checkable: compression that restores exactly what it stored, agents with a signed name and a spending limit they cannot exceed, and a receipt for everything that happened. Proof before praise.

**Hero actions:** See the products (→ #products, primary) · How buying works (→ #how, secondary). No Invest action — there is no `/invest` route (checked `server.mjs` + `vercel.json` 2026-11-05); do not add one without a route.

**Research behind the structure (2026-11-15, Tavily basic, 3 queries, 15 pulls filed to the Slidphiclepedia):** hero = headline of a few impactful words stating the core value, subheading answering who/what/why, at most a primary + secondary CTA; below the hero, sections answer buyer questions in order (what is this, does it work, who else uses it, how much, how do I get started), one job per section. Full-text reads: Prismic hero guide (215 lines), Big Human SaaS design (267 lines).

**Homepage rule (Corey, 2026-10-22; reaffirmed 2026-11-24): NO price figures anywhere on the homepage.** RESOLVED 2026-11-24: Corey ruled no prices on the homepage; the Ledger redesign removed every price from the homepage floor and meta tags. Prices live on product pages (with the Buy panel), /pay and /pricing. The homepage sells the tech and funnels to product pages and /pricing; prices live there, never here. **CONFLICT, flagged 2026-11-15:** the live storefront homepage (Nov 2026 "floor" redesign, origin/main d05c61f/890044a) lists prices on every product card, and Corey's 2026-11-15 restructure order keeps the product floor below the new top. The no-prices rule is NOT enforced on the floor until Corey rules — the 2026-11-15 edit changed only the top and left every price in place.

**Sections (live floor order, unchanged 2026-11-15):** Hero (who / vision / mission) · How a purchase works · CuNi calls · The rest of the floor (product cards) · What stays free.

---

## Product catalog reference

The homepage no longer carries the full shipped ledger (it carries the four lines in §02 above); the full catalog lives on /products. This table remains the reference for product lines and where their prices appear (product pages and /pricing only — never the homepage).

| Product | Line |
|---------|------|
| **PCC** | Hosted lossless compression. Send a file, get a smaller one back, restore every byte. Nothing to install. Silesia 51,498,645 · metered $0.25/GB of input, first 1 GB free once per IP (lifetime, no monthly reset) · Pro $25/mo (100 GB included, then $0.20/GB) — per `pricing.json` |
| **TNSSRC** | The local engine. Compress where the file sits, verify with decode plus SHA-256. 43,724,575 · 12/12 DECODE_OK · AGPL $0 |
| **pulsar** | Free GPLv3 binary for your own machine. No account, no phone-home. Silesia 55,745,438 · $0 |
| **TRUSTREAM** | The PCC plan for live logs — agent traces, SIEM, telemetry in 4 KiB tiles. Empty shrinks · never inflates · on a PCC seat |
| **Agent-Rider** | Signed identity for AI agents — a name that lasts fifteen minutes and proves itself on public keys. Solo $12/mo · Team $49/mo · Fleet $199/mo — per `pricing.json` · live at agentrider.fly.dev |
| **Warrant** | Signed mandates — these hosts, these actions, this spend cap — plus a receipt when the job runs. $8/mo add-on to Rider Solo; included in Team and Fleet |
| **Tollkeeper** | Ten live metered tools behind the lab meter. Call it, meter ticks, receipt files. Pay per call |
| **CuNi** | One program, 53 targets. Python, Go, and JS must print the same stdout, or it refuses. Studio $0 · signed Ed25519 audit receipts |
| **ExactOdds** | Provably-fair game rules — commit-reveal dice with identical rules on six runtimes. Open source · AGPL / commercial |
| **AwLPay** | Any token, any chain, converted through checkable value — or refused. x402 rails. Tron · BTC · Lightning · XLM · BSC |
| **Quikgater** | Pay-per-fact web fetching for agents. No subscription for a snippet. Pay per fetch |
| **TEACHAiD** | Campus app with a personal teacher that cites the textbook. Suspended · not on sale · residual (host stopped) |
| **Chamber** | Two-key JSON seal. One share is useless; every envelope carries its custody stamp. $20/mo · $200/yr · 33/33 tests green — per `pricing.json` |

---

## Building now (retired from the homepage 2026-10-22)

Dated, in progress, no vapor. Private R&D is labeled as such. Current items (Oct 2026): Llama teacher rollout for TEACHAiD, x402 money rails, monorepo verse fusion, new instruments. The sell-the-tech homepage no longer carries this section; keep items current wherever they surface, and do not let entries go stale.

---

## 03 Proof

Public benches with numbers (Silesia scores, decode rates, test counts) now lead the homepage via the §01 costs table. Every claim links to its run. No claim without a receipt.

---

## 04 From code

Full catalog link-out. Keep counts in sync with `llms.txt` / `ai.txt`.

---

## Access page (`/access`)

**Query params:** `product` (e.g. residual-governance, zrw-starting-gate) · `session` (Stripe Checkout Session id `cs_…`).

**When session present:** show “Checkout session received” + deliverable + mailto PACKAGE ACCESS prefilled with product + session.
**When product only:** show buy CTA + already-paid email path.

**Keyword:** **PACKAGE ACCESS** → corey@slidphilabs.com only.
**Do not** put the real engine on public npm or a permanent public URL.
**Future (needs host secret):** server retrieve session → `payment_status === 'paid'` → signed download URL. Secret key never in browser.

---

## Color / theme (poster-locked)

From `splabs-brand` **BRAND.md**: *gold ornate metal · teal/cyan glow · lotus · wings · mandala · third-eye light · deep cosmic navy*.

| Token | Hex | Use |
|-------|-----|-----|
| Cosmic navy BG | `#050b16` | page |
| Panel | `#0c1524` / `#122033` | cards |
| Text | `#eef4fb` | body |
| Muted | `#8fa3b8` | secondary |
| Teal glow | `#3dd6c6` / `#5ef0df` | primary CTAs, accents |
| Gold metal | `#e8c547` / `#c9a227` | ribbons, champion, Cinzel headings |
| Third-eye fire | `#ff9a3c` | badge pulse |
| Eye blue | `#5ba8ff` | secondary buttons |

**Type:** Cinzel (gold banners / brand) + IBM Plex Sans/Mono  
**House mark:** `/assets/logos/logo-slid-phi-labs.jpg?v=14`  
**Poster:** `https://www.slidphilabs.com/assets/now/og.jpg` (hero + footer strip)

---

## Do / don’t

| Do | Don’t |
|----|--------|
| Tagline + proof-first ledger | “Under Construction” |
| No price figures on the homepage; funnel to product pages + /pricing | Any price, plan, or per-unit figure on the homepage |
| Every claim with a receipt | Residual coefficients / hierarchy internals |
| Full Stripe map wired | Dead `*.vercel.app` links |
| Stub honesty + /access delivery | “Download full source on npm” |
| Master poster full-bleed | Crop third-eye or banners |
| Date every Building-now entry | Undated vapor |
