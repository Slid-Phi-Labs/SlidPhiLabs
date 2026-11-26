# Lab ledger — Slid Phi Labs, all projects

Built 2026-11-02. History pass same day back to repo birth (lab git
2026-07-29, 750 commits; psi git 2026-10-16; observatory 10-17→10-28).
One index + three areas. Each area holds one file per project.

**Attack list:** [TOP100-ATTACK.md](./TOP100-ATTACK.md) (positioning + effectiveness + betterment).  
**History:** [slidphilabs-history-timeline.ipynb](./slidphilabs-history-timeline.ipynb).

## Projects (full files in each area)

| Project | What | Canonical source |
|---|---|---|
| psi | Agent memory, 116 tweaks | `~/psi/SELL-KIT.md` |
| pcc | Hosted lossless compressor | `docs/site/licensing.json` |
| pulsar | GPLv3 compressor + STR1 | `docs/site/licensing.json` |
| cuni | CuNi Studio | `~/psi/goals.md` |
| chamber | Chamber SDK + smart-box | `docs/site/licensing.json` |
| rider | Agent-Rider + DMs | `docs/STATUS.md` |
| trugame | 30s demo game | `packages/trugame-v0.4` |
| tru8 | Zeros demo face (funnel) | `docs/NPM_PRICING.md` |
| spl-pay-per-suite | Metered suite client v1.2.3 | `packages/spl-pay-per-suite` |
| spl-model-pay | Model-metered billing v0.1.0 | `packages/spl-model-pay` |
| phi-rest | RAM-serve toy v0.1.0 | `packages/phi-rest` |
| warrant | Receipted warrants, $290/yr | `docs/site/licensing.json` |
| tnssrc | Closed grant $369/yr | `docs/site/licensing.json` |
| tollkeeper | Rider metered protection tools (posted prices on `/tollkeeper`) | [development/tollkeeper.md](./development/tollkeeper.md) |
| quikgater | Named pay-per-fetch face · $0.02 after 100 free/mo (kept, not archived) | [development/quikgater.md](./development/quikgater.md) · `pricing.json` |
| teachaid | School product, suspended | residual ledger |

## Lab timeline (money + rails)

- 2026-07-29: repo born; Stripe links from day one. Incoming $0 doctrine.
- 2026-08-07: x402 commerce + freemium suite; Try Gate retired.
- 2026-08-13: TRU8 face lock; Chamber born ($199 unlock trial).
- 2026-08-20: rent retired; Rider + engine seats in catalog.
- 2026-08-25: Stripe/x402 aligned, one price per SKU.
- 2026-09-05/06: YC W27 draft + live draft, unsubmitted (video required).
- 2026-09-09: hosted compression shipped; CuNi protocol published.
- 2026-09-21: tru8/blackjack consolidated into slid-phi.
- 2026-09-23/24: TNSSRC honesty arc (43.72M).
- 2026-10-16: psi born (116 wired, green gate, dual license).
- 2026-10-28: price truth sweep (369/37/890); funding figures; psi
  commercial-only + sell kit + winbox green; owner gratis lane.
- 2026-11-02: ledger built; HN draft unposted; ARC paper Order 0 pending.
- 2026-11-03: Nebius tokens + other credits issued to the lab (amounts TBD).
  First external pipeline: meeting with Eficens people later this month on
  product development (date, attendees, scope TBD).

## Lab-wide truths (do not re-derive per file)

- Incoming = **$0** until Stripe last-30-days is filled. Per funding figures.
- Break-even: lean ~$800/mo (~27 seats); funded ~$15k/mo (~490 seats).
- Runway plan: $500k YC or $750k seed, 18 mo. Per use of funds.
- Milestones: M3 numbers public → M6 repeat seat signal → M12 named
  customer → M18 default-alive or clean shutdown.
- Rails: humans Stripe, agents x402 (USDC Solana/Base), enterprise
  invoice/wire on request only. Contact corey@slidphilabs.com.
- Infra: Fly hosts live; Vercel lab hosts dead; RunPod $0 (all EXITED);
  MongoDB $500 plan delivered, awaiting go. 2026-11-03: Nebius tokens +
  other credits issued (vendors/amounts TBD) — extends bench/GPU runway.
- Pipeline: first external conversation = Eficens meeting, this month,
  product development (details TBD). Everything else: 0 leads, 0 trials.

## Known doc conflicts (recorded, not resolved)

- Suite free edge: **resolved** — quote unpaid **6.9 GB / 3 h**, then
  **$0.05/GB** (bulk **$0.04/GB**), min **$0.05** (`licensing.json` caps.suite,
  `pricing.json` suite, `/pps`, `spl-pay-per-suite`). Old 2 GB / 100 GB free
  claims retired (TOP100 #8, 2026-11-26).
- PCC year: **resolved** — quote **$250/yr** (`pcc-pro-year` in `licensing.json` /
  `pricing.json` / funding). Old $369 vs $390 / gc-year conflict retired
  (TOP100 #6, 2026-11-26).
- CuNi exception: canonical **$490** (`licensing.json` / unified grant).
  Fixed `api/cuni-plans.json` cents 36900→49000 on 2026-11-26 (TOP100 #7).

## Update rule (standing)

On every goal completion, update that project's three area files the same
session: financial (any price/cost/revenue change), development (version,
receipt, next milestone), b2b (pipeline, rails, license). Index truths
only change when a canonical source changes — cite the source.
