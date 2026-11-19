# Slid Phi Labs — Site Consistency Audit (read-only)

- **Date:** 2026-11-19
- **Branch:** `consistency-polish-2026-11-19` (clean tree at audit time; `git status` empty)
- **Scope:** `site/` vs `docs/site/` trees only, plus repo-level deploy/test config that decides which tree is live.
- **Method:** read-only. `grep -rn`, `diff -rq`, `git log/show`, file reads. No file was edited. `docs/site/scripts/render-platform.mjs` was **not** run. Nothing was pushed, deployed, or posted.
- **Canonical price list used for comparison:** the list supplied with this audit task (Rider $12/$49/$199; Warrant add-on; Tollkeeper crossing rates; Chamber $20/mo $200/yr; Quikgater; CuNi hosted calls; Lab Pass $495/yr; PCC $0.25/GB, 1 GB free, Pro $25/mo incl. 100 GB then $0.20/GB; TeachAid $9/mo; ACP $990; PSI Meter $25/seat/mo; GitDepot $15/seat/mo). Where the task canonical list and the repo's own live catalog disagree, **both are recorded and neither is declared right** (see §2.16, TeachAid).
- **Scale of the price grep:** `grep -rn -E '\$[0-9]'` over `site/` + `docs/site/` `*.html`/`*.txt`/`SKILL.md` returns **571 lines**. This audit inventories the canonical products exhaustively and the stale-price clusters by file count; the raw 571-line list is not pasted in full.

---

## 1. LIVE SOURCE OF TRUTH — which tree is deployed

### Verdict: `docs/site/` is the live deployed site. `site/` is a parallel stale snapshot with no deploy path.

Evidence for `docs/site/`:

| Evidence | File:line / detail |
|---|---|
| Deploy workflow watches only `docs/site/**` | `.github/workflows/fly-deploy.yml` — `paths: ["docs/site/**"]`, `working-directory: docs/site`, `flyctl deploy --remote-only --config fly.toml --app spl-slidphilabs` |
| Fly app config lives in `docs/site/` | `docs/site/fly.toml` — `app = "spl-slidphilabs"`, `primary_region = "iad"`, `[build] dockerfile = "Dockerfile"`, `internal_port = 8080`, health check `GET /healthz`, volume mount `spl_auth` → `/data` |
| Dockerfile runs the site server | `docs/site/Dockerfile` — `FROM node:20-trixie-slim`, copies whole context, downloads `pulsar`/`lb` engines, `CMD ["node", "server.mjs"]`, `ENV PORT=8080` |
| The server is in `docs/site/` | `docs/site/server.mjs` (549 lines) — `ROOT = __dirname` (its own directory), static serving + `/api/*.js` handler dispatch + `/v1/*` proxy (see §3) |
| Deploy docs point at `docs/site/` | `docs/site/FLY_PUBLIC.md` — deploy is `cd …/docs/site; fly deploy`; `docs/site/DNS_TO_FLY.md` — www + apex serve Fly, certs issued |
| Uptime CI probes the Fly host | `.github/workflows/uptime.yml` — `https://www.slidphilabs.com/api/health`, `https://slidphilabs.fly.dev/api/health`, apex → www 301/308 |
| Vercel is dead; Fly is the replacement door | `docs/site/FLY_PUBLIC.md` — "Vercel www is 402 DEPLOYMENT_DISABLED — this Fly app is the replacement public door"; `STATUS.md` — "Vercel: account/projects 402-locked" |
| `docs/site/vercel.json` exists but is legacy | `docs/site/vercel.json` — rewrites/redirects/headers for a Vercel deployment that is disabled per the two notes above; `docs/site/server.mjs` re-implements the essential rewrites in its `REWRITES` map (server.mjs:58+) |

Evidence `site/` is **not** live:

- No workflow, Dockerfile, `fly.toml`, `package.json`, `server.mjs`, or `api/` references `site/` anywhere. `grep -rn '"test:site"'` finds the string only in the three workflow files (see §8); no workflow mentions top-level `site/`.
- `site/` contains no server or router: 29 top-level entries, `assets/` (2 files: `lab-auth.js`, `site.css`), `.well-known/` (10 files), and no `api/`, `wiki/`, `scripts/`, `fly.toml`, or `Dockerfile`.
- `site/` was created wholesale in a single commit: `git log --follow -- site/index.html` shows only `7483606` ("LAO + trust batch: SEO graph, product pages, security/cto, usage gating prep, crawler snapshots (#91)"); `git show --name-only 7483606 | grep -c "^site/"` = **41 files**. The commit message's own phrase is "crawler snapshots".
- `site/` content is older/different: `site/index.html` is 7,177 bytes vs `docs/site/index.html` 13,442 bytes; `site/products.html` 4,274 vs 15,875; `site/chamber.html` 3,743 vs 5,375; `site/llms.txt` 1,460 bytes vs 20,585; `site/agents.txt` 836 vs 4,160. `diff -rq site docs/site` = **216 lines: 4 only-in-`site/`, 175 only-in-`docs/site/`, 37 files differ**.
- Files only in `site/`: `site/assets/site.css`, `site/cto.html`, `site/pricing-usage.html`, `site/security.html`. `site/chamber.html:33` links to `/pricing-usage` and `/security` — targets that exist **only** in `site/`, so those links are dead on the live tree.
- `site/` prices are the older set (TeachAid Pro $9/mo, CuNi capability promotion $9/mo — see §2), consistent with a snapshot, not the live catalog.

### App-name drift (recorded, not resolved)

- `docs/site/fly.toml`: app = **`spl-slidphilabs`**.
- `docs/site/FLY_PUBLIC.md`: app = **`slidphilabs`**; `docs/site/DNS_TO_FLY.md`: Fly `slidphilabs`, IPs `66.241.125.123` / `2a09:8280:1::164:6d7:0`.
- `docs/site/server.mjs:21`: `ncaBindApp(process.env.FLY_APP_NAME || "slidphilabs")` — default `slidphilabs`.
- `.github/workflows/fly-deploy.yml` deploys `--app spl-slidphilabs`; `.github/workflows/secret-hygiene.yml` and `uptime.yml` also use `spl-slidphilabs` / `slidphilabs.fly.dev`.
- The deploy workflow is authoritative for the deployed name (`spl-slidphilabs`); the two docs and the server default still say `slidphilabs`.

### Wiki serving

- `docs/site/wiki/` has **20 files**: `agent-rider, aos-ring, awlpay, chamber, cuni, exactodds, index, lab-pass, packages, pcc, psi-org, psi, pulsar, quikgater, tnssrc, tollkeeper, tru8, trustream, warrant, x402` (all `.html`).
- The wiki is served **from `docs/site/wiki/` itself** by `docs/site/server.mjs` `resolveStatic()` (server.mjs:386-404): `/wiki` → directory `index.html`; `/wiki/<slug>` → `wiki/<slug>.html` via the extensionless-`.html` fallback. There is **no `/wiki` entry in the `REWRITES` map** and no copy step in any workflow or Dockerfile — nothing copies wiki files elsewhere.
- `docs/site/sitemap.xml` lists 18 `wiki/*` URLs. `site/` has no `wiki/` at all.
- `docs/site/scripts/render-platform.mjs` writes `wiki/<slug>.html` and `wiki/index.html` **in place** under `docs/site/` (see §8). It is the wiki generator; it was not run for this audit.

---

## 2. PRICE INVENTORY

### 2.0 Price sources of truth inside the repo (for cross-checking, not as overrides)

- **Human-readable canonical page:** `docs/site/pricing.html` (lines cited below) and **`docs/site/pricing.json`** — `rule` field (pricing.json:6) plus `math` keys (`chamber_month 20`, `chamber_year 200`, `pcc_pro_month 25`, `pcc_meter_gb 0.25`, `lab_pass_year 495`, `rider_solo 12`, `rider_team 49`, `rider_fleet 199`, `tnssrc_grant_year 369`, `psi_meter_seat 25`, `psi_org 79`, `warrant_addon 8`, `cuni_check 0.05`, `quikgater_fetch 0.02`, `gitdepot_seat 15`, `teachaid_student 6`, `teachaid_pilot 2500`, `acp`/`consulting_hour 175`, `oss_support_year 199`, `grant_year 490`, `grant_founding 190`, `grant_3plus 390`).
- **Machine-readable catalog (the checkout source):** `docs/site/api/lib/payments-rails.js` `PRODUCT_CATALOG` (amounts in cents; line numbers below) and `docs/site/api/lib/mcp-catalogs.mjs` (price strings, e.g. chamber-month `$20/mo`, chamber-year `$200/yr`, rider-solo `$12/mo`, lab-pass `$495/yr`).
- **Agent price table:** `docs/site/llms.txt:30-51` (SKU table, all canonical — see §7).

### 2.1 Agent-Rider — Solo $12/mo, Team $49/mo, Fleet $199/mo (canonical: MATCH on live pages)

Live/canonical occurrences (selection; the pattern repeats on many pages):

- `docs/site/pricing.html:126` (summary: Solo $12/mo, Team $49/mo, Fleet $199/mo, overage $0.02, cap default 2× plan price, alert 80%), `:130` `$12 – $199 / mo`
- `docs/site/rider.html:54` (`Solo $12 – Fleet $199 / mo`), `:60` (`Buy a Rider seat — $12/mo`), `:74` (full seat text), `:127` `$12 / mo` + `$120/year`, `:128` `$49 / mo` + `$490/year`, `:129` `$199 / mo` + `$1,990/year`, `:153` (`Buy a Rider seat — $12/mo`)
- `docs/site/index.html:127-135` (card: `Solo $12 · Team $49 · Fleet $199`)
- `docs/site/wiki/agent-rider.html:49` (Solo $12/mo ($120/yr), Team $49/mo ($490/yr), Fleet $199/mo ($1,990/yr), overage $0.02)
- `docs/site/llms.txt:9,12,78,136` (seats from $12/mo to $199/mo; full annuals at :78); `docs/site/agents.txt:22,24,26` (12/49/199); `docs/site/ai.txt:19,21`
- `docs/site/api/lib/payments-rails.js:192` rider-solo 1200¢, `:204` rider-team 4900¢, `:213` rider-fleet 19900¢, `:222` rider-solo-year 12000¢, `:231` rider-team-year 49000¢, `:240` rider-fleet-year 199000¢
- `docs/site/.well-known/agents.txt:3` — `Rider Solo $12–Fleet $199` ✓

**Discrepancies — stale Rider prices (all conflict with canonical):**

| Stale figure | Location(s) |
|---|---|
| Solo **$3.31** – Fleet **$631** | `agent-one-liner` meta in 6 HTML files: `docs/site/demos/index.html:30`, `docs/site/ideas/index.html:28`, `docs/site/ideas.html:28`, `docs/site/pps/index.html:26`, plus 2 more files matching `Rider Solo \$3.31` (grep count = 6 files); `Fleet \$631` in 8 files (same set + `docs/site/access/index.html:338` `$631` as a price-table row) |
| Rider **$79/mo · $790/yr** (SKU `rider-month`/`rider-year`) | `docs/agent-skills/agent-rider/SKILL.md:23`; `docs/agent-skills/slidphi-labs/SKILL.md:43` (`$79/mo · $790/yr`); `docs/site/lab/NOTES_FOR_GROK.md:26` (`Rider $79/$790`) |
| Rider **$19.31** Bundle, **$49** Crew, **$199** Shop (legacy seat names) | `docs/site/ai.txt:19` (`rider-bundle $19.31 · rider-crew $49 · rider-shop $199`); `docs/site/agents.txt:23-25` (same table); `docs/site/llms.txt` does **not** list them. `payments-rails.js` marks `rider-bundle`/`rider-crew`/`rider-shop` as `retired()` → rider-team/rider-fleet, but the agent files list them without a "retired" note |
| Rider Ops **$37/mo · $369/yr** (separate fleet-watch SKU, not in task canonical list) | `docs/site/api/lib/payments-rails.js:249` (3700¢), `:257` (36900¢); `docs/site/api/lib/mcp-catalogs.mjs:22-23` (`$37/mo`, `$369/yr`) — consistent between the two code sources; no contradiction with canonical Rider seats, but the $37/$369 pair is visually confusable with the stale PCC/Chamber tiers |
| Root `package.json` `pricing.skus`: `rider-year` **$790** | `package.json` (`pricing.skus.rider-year.usd: 790`) — stale vs catalog rider-solo-year $120 / rider-team-year $490 / rider-fleet-year $1,990 |

### 2.2 Warrant — $8/mo add-on to Solo ($80/yr), included in Team/Fleet (canonical: MATCH on live pages)

- `docs/site/pricing.html:160` (`$8 / mo add-on · included in Team/Fleet`); `docs/site/warrant.html:7,20,23,26,31,37,38,46` ($8/month, $80/year, no standalone SKU); `docs/site/index.html:139-147` (card: `$8/mo · $80/yr`); `docs/site/wiki/warrant.html:49` ($8/mo ($80/yr), included in Team/Fleet, no standalone SKU); `docs/site/wiki/x402.html:49` (Warrant $8/mo add-on); `docs/site/llms.txt:24,79` ($8/month, $80/year); `docs/site/agents.txt:27` (`warrant-addon/addon-year 8/80`); `docs/site/ai.txt:19,22` (`warrant 8/80`, `$8/mo · $80/yr`); `payments-rails.js:267` (800¢), `:275` (8000¢)

**Discrepancies:**

| Stale figure | Location(s) |
|---|---|
| Warrant **$37/$369** | `docs/site/SKILL.md:9` (`Warrant $37/$369`) |
| Warrant **$29/mo · $290/yr** | `docs/agent-skills/warrant/SKILL.md:22`; `docs/agent-skills/slidphi-labs/SKILL.md:44` (`$29/mo · $290/yr`); `docs/site/lab/NOTES_FOR_GROK.md:26` (`Warrant $29/$369`) |
| Retired SKUs `warrant-month`/`warrant-year` | `docs/site/SKILL.md:19`, `docs/site/ai.txt:14`, `docs/site/agents.txt:15` (`skus warrant-month/year`) — `payments-rails.js` marks both `retired()` → warrant-addon; agent files do not say retired |

### 2.3 Tollkeeper — seven protection tolls + ten metered tools

Live page `docs/site/tollkeeper.html` (seven tolls, L55-105 region):

| Toll | `docs/site/tollkeeper.html` | `docs/site/wiki/tollkeeper.html:47-55` (table) |
|---|---|---|
| 1 Identity check | `:64` $0.005/check, 100/mo free | `:49` $0.005, first 100/mo free, local JWKS free ✓ |
| 2 Lookup | `:70` $0.02/lookup, listing free; `:71` promote $9/mo | `:50` $0.02, listing free, Promote $9/mo ✓ |
| 3 Escrow | `:76` (region) 1% escrow routing | `:51` 1% ✓ |
| 4 Grant | `:82` $0.01 issue · $0.005 check | `:52` $0.01 issue, $0.005 check ✓ |
| 5 Exactness check | `:88` **$0.10 per check** | `:53` **$0.05** — **DISCREPANCY** |
| 6 Bond | 1% at stake (region) | `:54` 1% at stake ✓ |
| 7 Memory transfer | `:100` $0.02 hosted transfer, format free | `:55` $0.02 hosted, format free ✓ |

Ten metered tools (`docs/site/tollkeeper.html:111-165`): pcc-compress $0.01/MB in, pcc-verify $0.02, attest-notarize $0.01, attest-exactness **$0.05** (`:129`), exactodds-draw $0.01, exactodds-resolve $0.02, cuni-proof $0.10, trustream-pack $0.01/MB in, chamber-seal $0.02, awlpay-quote $0.005. These match `docs/site/llms.txt:56` exactly (same ten, same figures). **The $0.05 vs $0.10 split is internal to Tollkeeper itself:** the ten-tool list and the wiki table and `docs/site/index.html:166` ("exactness $0.05") all say $0.05, while Toll 5 on `docs/site/tollkeeper.html:88` says $0.10. The `docs/site/index.html:166` card also lists "CuNi proof $0.10" and "Chamber seal $0.02", matching the ten-tool list.
- `docs/site/SKILL.md:9` says only "Tollkeeper per call" (no figures — no conflict, no confirmation).
- `docs/site/llms.txt:25` — Tollkeeper tools at `POST https://agentrider.fly.dev/api/toll/tools/<name>`, schema `GET https://agentrider.fly.dev/api/toll/schema`.

### 2.4 Chamber — $20/mo · $200/yr (canonical: MATCH on live pages; stale $9/$37/$369 everywhere else)

Live/canonical:

- `docs/site/chamber.html:14` (og:description `$20/mo · $200/yr`), `:32` (`Chamber is $20/month, $200/year … 24-hour try. Opening already-sealed blobs is free forever. Sealing is not metered.`)
- `docs/site/pricing.html:120` (`$20 / mo · $200 / yr`); `docs/site/index.html:115-123` (card `$20/mo · $200/yr`); `docs/site/wiki/chamber.html:49` (`$20 a month or $200 a year. … SKUs chamber-month and chamber-year.`); `docs/site/wiki/index.html:42` (Chamber summary: `$20 or $200`); `docs/site/wiki/x402.html:49` (Chamber $20/mo or $200/yr); `docs/site/products.html:46-47` (meter, no price — see §4); `docs/site/llms.txt:77` ($20/mo · $200/yr); `docs/site/agents.txt:28` (`chamber-month/year 20/200`); `docs/site/ai.txt:19,28` (`chamber 20/200`, `$20/mo · $200/yr`); `docs/site/.well-known/agents.txt:3` (`Chamber $20/$200`); `payments-rails.js:86` (2000¢), `:94` (20000¢); `mcp-catalogs.mjs:15-16` (`$20/mo`, `$200/yr`); `docs/site/lab-pass.html:39` (Chamber alone $200)

**Discrepancies — the task's example ($9/mo / $37) is confirmed, and it is widespread:**

| Stale figure | Location(s) |
|---|---|
| **Chamber Year · $369** button | **30 HTML files**, all under `docs/site/` (0 in `site/`): `blog/2026-08-03…`, `blog/2026-08-04…`, `blog/2026-08-07-access-try-gate-loop`, `blog/2026-08-07-freemium-suite-retires-try-gate`, `blog/2026-08-07-two-doors-one-lab`, `blog/2026-08-07-why-8b-matters`, `blog/index.html`, `datacenters/index.html`, `demos/index.html`, `duos/index.html`, `ideas/index.html`, `join/index.html`, `olympiad/index.html`, `standings/index.html`, `toys/index.html`, `updates/index.html`, `web/index.html`, `codex.html`, `convert.html`, `datacenters.html`, `duos.html`, `ideas.html`, `join.html`, `olympiad.html`, `standings.html`, `toys.html`, `updates.html`, `web.html`, `weights-vs-files.html` (each: `<a … href="/pay?sku=chamber-year">Chamber Year · $369</a>`). Note the href SKU is the live `chamber-year` but the label price is the stale $369 — the button would charge the live $200 while advertising $369. The same files exist as both `X.html` and `X/index.html` twins (see §5 note). |
| **Chamber $9/$369** one-liner | 6 HTML files: `docs/site/demos/index.html:30`, `docs/site/ideas/index.html:28`, `docs/site/ideas.html:28`, `docs/site/pps/index.html:26`, `docs/site/drverified.html:11,27` (meta/JSON-LD "Live SoT: … Chamber $9/$369 …"), +1 more matching file |
| **Chamber $37/$369** | `docs/site/SKILL.md:9` (`Chamber $37/$369`); `docs/site/intertwine.html:113` (price ladder "Chamber $37/$369") |
| **Chamber $9/mo · $99/yr** | `docs/agent-skills/chamber/SKILL.md:25`; `docs/agent-skills/slidphi-labs/SKILL.md:42` (`$9/mo · $99/yr`) |
| **Chamber $9 / 30 days** | `docs/site/access/packs/chamber/what-ships.md:11` |
| `json-chamber $99 forever` / old `$19 / $99 / $1,750 TruChamber` links | `docs/site/access/HOST_STRIPE_SUCCESS_URL.md:26,29` |
| **Chamber $37/mo** (solo) | `docs/site/intertwine.html` (truncated ladder text, see grep) |
| **No seat price at all** (only $0.02/seal toll + enterprise) | `site/chamber.html:33` — the `site/`-tree Chamber page states no $20/$200 figure; it also links `/pricing-usage` and `/security`, which exist only in `site/` |

**Note on the task's example:** `docs/site/wiki/chamber.html` does **not** show $9/mo or $37 — its Price section (:49) is the canonical $20/$200. The $9/$37 figures live in the one-liners, buttons, `SKILL.md`, and `docs/agent-skills/`, not in the wiki booklet. Recorded as found, not as the task example assumed.

### 2.5 Quikgater — $0.02/fetch (canonical: MATCH everywhere checked)

- `docs/site/quikgater.html:7,27,46` ($0.02 per fetch, first 100/month free, cap default $10, alert 80%, x402 on Base, worker `quikgater-worker.ceedotrock.workers.dev`)
- `docs/site/index.html:151-159` (card: `$0.02 per fetch`); `docs/site/wiki/quikgater.html:49` (same); `docs/site/llms.txt:44,84` ($0.02, first 100 free, cap $10); `payments-rails.js` quikgater entry (amount 0, blurb "Pay $0.02 per fetch…", `:350-358` region, x402 `https://quikgater-worker.ceedotrock.workers.dev/`). No conflicting figure found.

### 2.6 CuNi hosted calls — check $0.05, translate $0.10, squeeze $0.10, audit $1.00 (canonical: MATCH on live pages, with one $0.10-vs-$0.05 conflict)

Live call list `docs/site/index.html:78-96` ("CuNi calls", 9 calls): check $0.05 (first 100/mo free), translate $0.10, ingest $0.10, money $0.25, time $0.25, parity $0.25, chain $0.50, ship $0.50, audit $1.00; closed-app grant $490/yr (`:94`). Meta description `docs/site/index.html:8` confirms "CuNi check $0.05, translate $0.10, audit $1.00".
- `docs/site/cuni.html:32` (JSON-LD Offer price 0.05 per-check, first 100 free), `:62` (Closed-app $490/yr), `:133` ($0 Studio), `:139-140` ($490/yr, per-check first 100 free then $0.05)
- `docs/site/llms.txt:81,130` (per-check first 100 free, then $0.05; closed-app grant $490/yr); `docs/site/wiki/cuni.html:49` (same); `payments-rails.js:167` lab-check 5¢, `:176` lab-translate 10¢, `:184` lab-squeeze 10¢; `mcp-catalogs.mjs:12` (CuNi Studio $0), `:13` (closed-app $490/yr)
- `docs/site/.well-known/ai-products.json:19,26,33` — `/v1/check`, `/v1/translate`, `/v1/squeeze` (no prices in that file)

**Discrepancies:**

| Stale figure | Location(s) |
|---|---|
| lab-check **$0.10** (vs live $0.05) | `docs/agent-skills/cuni/SKILL.md:28` (`POST https://spl-lab-agent.fly.dev/v1/check SKU lab-check $0.10`); same file `:29` lab-translate $0.10 (matches live translate), `:39` lab-squeeze $0.10 (matches) |
| CuNi capability promotion **$9/month per capability** (Stripe, flag-gated) | `site/`-tree only: `site/pricing-usage.html:40`, `site/llms-full.txt:35-36`. Not present in `docs/site/` canonical catalog. |
| CuNi "144 langs" | `docs/agent-skills/slidphi-labs/SKILL.md:45` ("One program, 144 langs") vs 53 targets everywhere else — count discrepancy, not a price |
| `lab-check`/`lab-translate`/`lab-squeeze` **$0.10 each** (grouped) | `docs/agent-skills/slidphi-labs/SKILL.md:57` — lumps check in at $0.10, conflicting with live $0.05 |

### 2.7 Lab Pass — $495/yr (canonical: MATCH on live pages; $890 is the stale rival)

Live/canonical:

- `docs/site/pricing.html:177` (parts sum $650; bundle $495, 24% off), `:180` (`$495 / yr`); `docs/site/lab-pass.html:7,17,22,26,33,35` ($495/year, parts $650, PCC out, no monthly version; Chamber alone $200, Rider Solo alone $120/year); `docs/site/index.html:175-183` (card: parts $650, pass $495, `$495/yr`); `docs/site/wiki/lab-pass.html:49` ($495/yr, parts $650, 24% off); `docs/site/llms.txt:86` ($495/yr, same composition); `docs/site/agents.txt:34` (`lab-pass 495`); `docs/site/ai.txt:19,29` ($495, same composition); `docs/site/.well-known/agents.txt:3` (`Lab Pass $495`); `payments-rails.js:299` (49500¢, blurb "Parts $650; bundle $495"); `mcp-catalogs.mjs:25` (`$495/yr`)

**Discrepancies — Lab Pass $890 (different bundle composition, not just a different number):**

| Stale figure | Location(s) |
|---|---|
| Lab Pass **$890/yr** = Chamber year + **PCC Year** + psi seat; Rider NOT included | `docs/site/SKILL.md:11`; `docs/site/box.html:67` ("Lab Pass $890 is Chamber year + PCC Year + psi commercial seat. It does not include Rider."); `docs/site/drverified.html:11,27,36` ("Live SoT: … Lab Pass $890 …", "$890 for Chamber year + PCC Year + psi seat, 365 days. Rider not included.") |
| Root `package.json` `pricing.skus`: `lab-pass` **$890**, `gc-year` **$369** | `package.json` — `lab-pass.usd: 890`, `gc-year.usd: 369`, `rider-year.usd: 790`, `consulting.usd: 250` (consulting $250 flat vs catalog $175/hr, 2-hr min = $350 — see §2.13) |
| Lab Pass $890 in funding/ledger docs (outside the site trees) | `docs/funding/FUNDING_FIGURES.md:12`, `docs/funding/ONE_PAGER.md:18`, `docs/lab-ledger/b2b/chamber.md:5`, `docs/lab-ledger/financial/chamber.md:9`, `docs/lab-ledger/financial/psi.md:6` |
| psi Lab Pass **$490/yr** (a third figure) | `docs/site/pricing.json` `rule` field (:6): "psi Lab Pass $490/yr" inside the PERsiST sentence — conflicts with both $495 and $890; no other file found stating $490 for Lab Pass |

### 2.8 PCC — $0.25/GB, 1 GB free, Pro $25/mo incl. 100 GB then $0.20/GB (canonical: MATCH on price; FREE-WINDOW wording splits)

Live/canonical price figures:

- `docs/site/pricing.html:28` (metered $0.25/GB, first 1 GB free once per IP — lifetime, no monthly reset; Pro $25/mo, 100 GB, then $0.20/GB), `:34` (meter summary), `:38` (`$0.25 / GB input · 1 GB free`), `:44` (Pro summary), `:48` (`$25 / month`), `:54` (Pro annual summary), `:58` (`$250 / year`), `:64` (agents summary, same meter)
- `docs/site/docs.html:38` (same meter + Pro + `POST /api/ppp-quote`, prices `/pricing`, source of truth `pricing.json`)
- `docs/site/index.html:103-111` (card: first 1 GB free once per address, then $0.25/GB; Pro $25/mo for 100 GB, then $0.20/GB; `Buy Pro · $25/mo`)
- `docs/site/llms.txt:35,72,112,124` (meter $0.25/GB, first 1 GB free once per IP, lifetime, no monthly reset; Pro $25/mo, annual $250); `docs/site/ai.txt:24` (stale tier — see below)
- `docs/site/wiki/pcc.html:49` — price figures match ($0.25/GB, Pro $25/mo, $0.20/GB) **but the free window is worded "the first 1 GB a month is free"** (see window split below)
- `payments-rails.js` PCC entries: `pcc-pro` `:105` (2500¢), `pcc-pro-year` `:114` (25000¢), PCC usage blurb "meter: $0.25 per GB … first 1 GB free once per IP; Pro $25/month includes 100 GB, then $0.20/GB" (`:340` region, amount 0 — meter, not a seat SKU)
- `mcp-catalogs.mjs:17-18` (PCC Pro $25/mo, Pro year $250/yr), `:24` (suite: "1 GB free once per IP, then $0.25/GB")
- MCP tools `spl_compress` / `spl_quote` (`docs/site/api/mcp.js:63,116`) state the same meter ($0.25/GB after first 1 GB free once per IP; $1 card minimum on quote)

**Discrepancies:**

| Stale/conflicting figure | Location(s) |
|---|---|
| PCC **$9/day · $37/mo (200 GB) · $369/yr (2 TB), then 8¢/GB** | `docs/site/ai.txt:24`; `docs/site/agents.txt:29` (`pcc-day/month/year 9/37/369`); `docs/site/SKILL.md:9` (`PCC $9/$37/$369`); `docs/site/llms.txt` does NOT contain it. `payments-rails.js` marks `gc-day`/`gc-month`/`gc-year` as `retired()` → PCC meter / pcc-pro / pcc-pro-year, but the agent files list the tiers without a "retired" note |
| PCC **$9/$37/$369** one-liner | 8 HTML files: `docs/site/demos/index.html:30`, `docs/site/ideas/index.html:28`, `docs/site/ideas.html:28`, `docs/site/pps/index.html:26`, `docs/site/drverified.html:11,27`, +2 more matching files (grep count = 8) |
| PCC **$37/mo** button/label | `docs/site/access.html:31` (one-liner: `PCC $9/$37/$369`); `docs/site/intertwine.html` ladder (PCC $37/$369 region) |
| PCC Pro **$49/mo, 200 GB, then 8¢/GB**; usage **first 2 GB/mo free then 8¢/GB** | `docs/agent-skills/pcc/SKILL.md:23`; `docs/agent-skills/slidphi-labs/SKILL.md:40` (same two figures) |
| PCC **first 2 GB each month free, then 8¢/GB** (retired meter) | `docs/site/blog/2026-09-09-hosted-dual-license.html:43` ("First 2 GB each month are free. Then 8¢/GB, $1 card minimum. PCC month is $49 and includes 200 GB."); `docs/site/blog/index.html:196` ("first 2 GB each month free, then 8¢/GB"); `docs/site/SKILL.md:10` (TRUSTREAM meter: "first 2 GB/month free, then 8¢/GB"); `docs/site/drverified.html` ("2 GB/mo then 8¢/GB"); `docs/site/access.html:31` does NOT carry it — see below |
| **Free-window wording split (live pages disagree with each other):** "first 1 GB free **once per IP (lifetime, no monthly reset)**" vs "first 1 GB **each month / a month** free" | Lifetime wording: `docs/site/pricing.html:7,13,19,22,28,34,38,64`; `docs/site/docs.html:38`; `docs/site/llms.txt:35,72,124`; `payments-rails.js` blurb; `mcp-catalogs.mjs:24`. Monthly wording: `docs/site/pcc.html:48` ("The first 1 GB each month is free"), `:71` ("First 1 GB / month free, then $0.25/GB"); `docs/site/wiki/pcc.html:49` ("the first 1 GB a month is free"); `docs/site/.well-known/agents.txt:3` ("1 GB/mo then $0.25/GB"); `docs/site/.well-known/mcp/server-card.json` description ("first 1 GB/month free, then $0.25/GB"). Grep for the stale-meter pattern set (`1 GB/mo` / `1 GB a month` / `2 GB/mo` / `first 2 GB` / `8¢/GB`) returns **100 lines** across `site/`+`docs/site/` HTML/TXT/MD excluding `web-samples/` and `blog/`; representative non-blog carriers: `docs/site/datacenters/index.html`, `docs/site/demos/index.html`, `docs/site/humans/index.html`, `docs/site/pps/index.html`, `docs/site/standings/index.html`, `docs/site/try/index.html`, `docs/site/web/index.html`, `docs/site/access.html`, `docs/site/datacenters.html`, `docs/site/drverified.html` |
| PCC month **$49 / 200 GB** in blog | `docs/site/blog/2026-09-09-hosted-dual-license.html:43` (see above) |
| `site/`-tree PCC | `site/index.html:42` ("Free allowance: TBD"); `site/llms.txt:11` ("Hosted suite + PCC: metered jobs. Free allowance: TBD") — no price at all, not a conflicting price |

### 2.9 TeachAid — task canonical $9/mo vs live $6/mo student (UNRESOLVED CONTRADICTION — recorded both ways)

- **Live `docs/site/` price is $6/mo student:** `docs/site/teachaid.html:7,27,51` (Student $6/month, $60/year; institutional pilot $2,500/campus/semester, up to 500 students); `docs/site/pricing.json` math (`teachaid_student 6`, `teachaid_pilot 2500`); `docs/site/llms.txt:85,151` (Student $6/month, $60/year; pilot $2,500); `docs/site/api/lib/payments-rails.js:398` (teachaid-student 600¢), `:406` (teachaid-student-year 6000¢), `:414` (teachaid-pilot 250000¢); `docs/site/llms.txt:47` table (`teachaid-student 6/60`, `teachaid-pilot 2500`).
- **Task canonical $9/mo ("TeachAid Pro") appears only in the `site/` tree and one agent skill:** `site/products.html:32` ("TeachAid Pro: $9/month (already public in TeachAid pricing)"), `site/humans.html:39` ("Pro is $9/month, already public on TeachAid's own pricing page"), `site/pricing-usage.html:41` ("TeachAid Pro $9/month … includes Pro voice picker"), `site/llms-full.txt:21` (same), `site/llms-full.txt:35-36` (only prices stated in that file); `docs/agent-skills/teachaid-spu/SKILL.md:57` ("Pro subscription: $9/mo" — plus `:55` school $275 one-time, `:56` curriculum review $3, which appear nowhere in the site trees).
- `docs/site/products.html:161-165` (TEACHAiD detail) states **no price**; `docs/site/teachaid.html:46` says "Teacher chat is moving to Llama" (stale vs live Groq per lab memory — not a price, noted only because the page is the price carrier).
- No file in either tree shows both $6 and $9 for the same TeachAid tier, so this is a naming/tier question (Student $6 vs Pro $9), not a same-line conflict. **Do not decide which is right; the task canonical ($9) and the live catalog ($6 student) disagree.**

### 2.10 ACP — $990 one-time certification, ACP itself $0 (canonical: MATCH)

- `docs/site/subs/acp/index.html:38` ("ACP is $0, an open standard. 'ACP Conformant' certification is $990 one-time … 3 free pilot certifications, assessment criteria published."); `docs/site/llms.txt:88` (same); `docs/site/pricing.json` math (acp — certification 990 in `rule`/products); `payments-rails.js:422` (acp-certification 99000¢, blurb "3 free pilot certifications"). No conflicting figure found.

### 2.11 PSI Meter — $25/seat/mo, $250/seat/yr (canonical: MATCH on live pages)

- `docs/site/pricing.html:136,137,140` ($25/seat/month, 250,000 calls/mo included, then $2 per additional 100,000; free 1 seat, 10,000 calls/mo, 7-day retention; first audit free; `$25 / seat / month`); `:150` (PSI Org $79/month); `docs/site/wiki/psi.html:49` and `docs/site/wiki/psi-org.html:49` (same $25/$250 terms; PSI Embed unified grant $490/yr); `docs/site/llms.txt:37,89` (psi-meter 25/250; PSI Meter $25/seat/month, $250/seat/year); `payments-rails.js:123` (psi-meter 2500¢), `:132` (psi-org 7900¢), `:158` (psi-meter-year 25000¢); `docs/site/wiki/index.html:42` (psi summary: "$25 a seat a month")

**Discrepancies:**

| Stale figure | Location(s) |
|---|---|
| PSI Meter **$19/mo**, Org $79 | `docs/site/blog/2026-10-28-psi-fifth.html:7,33,37` ("PSI Meter is $19/month. Org is $79."; "Meter it — $19/mo"); `docs/site/blog/index.html:148` ("PSI Meter $19/mo, first audit free"); `docs/site/press.txt:89` ("PSI Meter $19/month, PSI Org $79/month") — 2+ files carry the $19 figure outside `blog/` (`press.txt` + blog index/post) |
| psi-month / psi-year SKUs | `docs/site/wiki/psi.html:49` says retired; `docs/site/ai.txt` does not list them; `payments-rails.js` marks both `retired()` → psi-grant. Consistent. |

### 2.12 GitDepot — $15/seat/mo, $150/seat/yr (canonical: MATCH)

- `docs/site/subs/gitdepot/index.html:44` ($15/seat/month, $150/seat/year; 100 GB pooled, then $0.10/GB/month overage; free 1 team, 3 seats, 10 GB, 30-day retention; invite-only); `docs/site/llms.txt:87` (same); `payments-rails.js:380` (1500¢), `:389` (15000¢); `site/products.html:44-46` (GitDepot section, no price — not a conflict). No conflicting figure found.

### 2.13 Other priced items found in the same grep (not in the task canonical list, recorded for completeness)

- **TNSSRC grant $369/yr** (founding $190 first 10; 3+ products $390 each): `docs/site/pricing.html:74,78`; `docs/site/llms.txt:73,115`; `docs/site/wiki/tnssrc.html:49`; `payments-rails.js:307` (36900¢); `pricing.json` math. **Exception:** `docs/site/ai.txt:27` says pulsar closed embed **$369/yr** (should be $490 per `llms.txt:75`, `pricing.html:98`, `payments-rails.js:291` 49000¢) — stale $369 attached to the wrong product.
- **pulsar closed embed $490/yr; binary $0 GPLv3:** `docs/site/pricing.html:98`; `docs/site/llms.txt:75`; `docs/site/wiki/pulsar.html:49`; `payments-rails.js:291`.
- **Unified grant $490/product/yr** (founding $190; 3+ $390): `docs/site/pricing.html` (via `pricing.json` rule), `docs/site/llms.txt:48`; `payments-rails.js:142` (49000¢), `:364` (founding 19000¢), `:372` (volume 39000¢).
- **CuNi closed-app grant $490/yr:** §2.6.
- **AwLPay:** Free 0.5%/payment, no fixed fee; Pro **$39/mo**; L33t **$799/mo**; $1 minimum send. `docs/site/awlpay.html:7,14,17,20,26,91,96,97`; `docs/site/wiki/awlpay.html:49`; `docs/site/llms.txt:59,145`; `docs/site/ai.txt:32`. Consistent everywhere checked. (AwLPay has no catalog entry in `payments-rails.js` — not found there; its pricing lives only in pages/agent files.)
- **Consulting $175/hr, 2-hr minimum ($350):** `docs/site/llms.txt:90`; `payments-rails.js:332` (35000¢), `mcp-catalogs.mjs:26` (`$350`). **Exception:** root `package.json` `pricing.skus.consulting.usd: 250` ($250 flat) conflicts.
- **OSS support $199/yr per public library:** `docs/site/llms.txt:90`; `payments-rails.js:430,438,446` (19900¢); `mcp-catalogs.mjs:27` (`$199`).
- **TNSSRC bake-off $19.31/mo:** `docs/site/ai.txt:19,25`; `docs/site/agents.txt:31`; `payments-rails.js:315` (1931¢); `pricing.json` math `tnssrc_bakeoff_month 19.31`. Consistent.
- **Rider Ops $37/mo · $369/yr:** §2.1.
- **Foundry+** (Lab Pass + TNSSRC grant + Rider Crew, no price stated): `docs/site/ai.txt:19,30`; `docs/site/agents.txt:35`. `pricing.json` rule says "Foundry+ retired". No price found for it anywhere.
- **TRU8 / specialist:** no price stated in `docs/site/wiki/tru8.html:49` ("The specialist page and /pricing list the seat") — `docs/site/pricing.html` has no TRU8 price line; `tru8-year $990` appears only in `docs/site/access/packs/tru8*/` checklists (`tru8-year $990`, `truchamber-year` $990). Not in the task canonical list; recorded as found.
- **TeachAid pilot $2,500/campus/semester:** §2.9.

### 2.14 Discrepancy count (distinct stale-price patterns, live-tree HTML/TXT/MD + agent skills)

1. Chamber Year $369 button — 30 HTML files.
2. Chamber $9/$369 one-liner — 6 files.
3. Chamber $37/$369 — `SKILL.md:9`, `intertwine.html`.
4. Chamber $9/$99 — 2 agent-skill files (+ `access/packs/chamber/what-ships.md` $9/30 days).
5. PCC $9/$37/$369 tiers — `ai.txt`, `agents.txt`, `SKILL.md` + 8 HTML one-liner files.
6. PCC $49/mo + first-2-GB/8¢ meter — 2 agent-skill files + blog/post + `SKILL.md:10`.
7. PCC free-window wording (lifetime vs monthly) — `pcc.html:48,71`, `wiki/pcc.html:49`, `.well-known/agents.txt:3`, server-card description vs `pricing.html`/`llms.txt`/catalog.
8. Rider $3.31–$631 — 6–8 files.
9. Rider $79/$790 — 2 agent-skill files + `lab/NOTES_FOR_GROK.md`.
10. Warrant $37/$369 (`SKILL.md:9`) and $29/$290 (2 agent-skill files).
11. Lab Pass $890 — `SKILL.md:11`, `box.html:67`, `drverified.html` (3 hits) + root `package.json` + funding/ledger docs; plus psi Lab Pass $490 in `pricing.json` rule.
12. PSI Meter $19/mo — blog post + blog index + `press.txt:89`.
13. TeachAid $9 Pro (site tree) vs $6 student (live tree) — unresolved tier question (§2.9).
14. Toll 5 exactness $0.10 (`tollkeeper.html:88`) vs $0.05 (wiki, llms, index card).
15. CuNi lab-check $0.10 (agent skills) vs $0.05 (live).
16. pulsar embed $369 (`ai.txt:27`) vs $490.
17. Consulting $250 flat (root `package.json`) vs $350 (catalog).
18. `docs/site/access.html:31` one-liner mixes both eras in one line: "Chamber $9/$200 · PCC $9/$37/$369 · Rider Solo $12–Fleet $199 · first 1 GB once per IP then 25¢/GB" — Chamber month $9 (stale) with year $200 (live); PCC tiers stale; Rider live; meter live.

Total: **18 distinct discrepancy patterns** (counting per pattern, not per file). By file, the stale Chamber-year button alone touches 30 files; the stale `agent-one-liner` meta (Chamber $9/$369 + PCC $9/$37/$369 + Rider $3.31–$631 + 2 GB/8¢) is duplicated across `demos/`, `ideas/`, `pps/` (+ `index.html` twins) and `drverified.html`.

---

## 3. ROUTE INVENTORY — /v1/ vs /api/

### 3.1 /v1/ mentions in the eight named files: ZERO

| File | `/v1/` count | `/api/` count |
|---|---|---|
| `site/index.html` | 0 | 2 (`:20` api/agent link; `:43` `www.slidphilabs.com/api/mcp`) |
| `site/docs.html` | 0 | 6 (`:20` api/agent; `:33` agentrider `/api/agents`; `:38` `/api/rider/issue`; `:42` `/api/rider/verify`; `:47` agentrider `/api/mcp`; `:75` slidphilabs `/api/mcp`) |
| `site/products.html` | 0 | 3 (`:20` api/agent; `:30` rider `/api/agents`, `/api/rider/issue`, `/api/rider/verify`, `/api/mcp`; `:42` both `/api/mcp`) |
| `site/llms.txt` | 0 | 2 (`:8` rider `/api/agents`, `/api/rider/issue`, `/api/rider/verify`; `:12` `/api/mcp`) |
| `site/agents.txt` | 0 | 5 (`:5-6` both `/api/mcp`; `:9-11` rider `/api/agents`, `/api/rider/issue`, `/api/rider/verify`) |
| `docs/site/SKILL.md` | 0 | 8 (`:10` `/api/ppp-quote`; `:14` `/api/agent`; `:16` `/api/x402-products`; `:18` agentrider `/api/dm`; `:24` `/api/agent`; `:32-33` `/api/auth`; `:36` `/api/x402-products`, `/api/access-verify`) |
| `docs/site/llms.txt` | 0 | 25 (see §3.3) |
| `docs/site/openapi.yaml` | 0 | 12 (paths §3.2) |

### 3.2 /v1/ mentions anywhere in either tree (all file types): 26 hits, all in `docs/site/` + agent skills

- **Live homepage (the only /v1/ on a live page):** `docs/site/index.html:58` ("Hosted calls use one short name on the command line, on POST /v1/<name>, on MCP, and in the Python client"), `:190` ("POST /v1/squeeze is one call at $0.10"), `:195` ("POST /v1/squeeze · $0.10").
- **Router:** `docs/site/server.mjs:446-451` — exact-match proxy for `/v1/check`, `/v1/translate`, `/v1/squeeze`, `/v1/deposit`, `/v1/replicate`, and prefix `/v1/deposit/`.
- **Discovery JSON:** `docs/site/.well-known/ai-products.json:19` (`/v1/check`), `:26` (`/v1/translate`), `:33` (`/v1/squeeze`) — with `store: https://spl-lab-agent.fly.dev/`, `store_status: "suspended"`, note "The Fly app spl-lab-agent is not serving."
- **Agent skills:** `docs/agent-skills/cuni/SKILL.md:28,29,39` (`https://spl-lab-agent.fly.dev/v1/check|translate|squeeze`); `docs/agent-skills/slidphi-labs/SKILL.md:57` ("Lab verbs $0.10 each").
- **Third-party /v1/ (not lab routes):** Stripe `https://api.stripe.com/v1/...` in `payments-rails.js:916,932`, `ppp-checkout.js:91`, `rent-game.js:115`, `rider/claim.js:151`, `access-verify.js:1096`, `sku-price-map.mjs:36`, `refund-live.test.mjs:15`; Notion `https://api.notion.com/v1/pages` in `feedback-submit.js:38`, `join-work.js:115`, `ppp-job.js:50`, `support-onboard.js:73`, `x402-products.js:472`, `x402-suite.js:288`.

### 3.3 /api/ endpoints mentioned (named files + openapi)

**`docs/site/openapi.yaml`** (290 lines; 15 paths): `/api/auth`, `/mcp`, `/api/welcome`, `/api/agent`, `/api/olympiad`, `/olympiad.json`, `/toys.json`, `/platform.json`, `/api/x402-products`, `/api/x402-suite`, `/api/checkout`, `/api/compress`, `/api/payments`, `/api/web-codec`, `/api/ppp-quote`. **Zero `/v1/` paths.**
**`site/openapi.yaml`** (48 lines; 4 paths, Rider host only): `/api/agents`, `/api/rider/issue`, `/api/rider/verify`, `/api/mcp` (servers: `agentrider.fly.dev`, `www.slidphilabs.com`).

**`docs/site/llms.txt` /api/ mentions (25):** `:18` GET `/api/agent`; `:20` POST `/api/x402-products` (X-PAYMENT, 402); `:22` POST `/api/rider/claim`; `:23` POST agentrider `/api/dm`; `:25` POST agentrider `/api/toll/tools/<name>`, GET `/api/toll/schema`; `:35` pcc-meter `/pps`; `:51` POST `/api/x402-products`; `:54` agentrider `/api/dm`, `/api/mcp`; `:56` agentrider `/api/toll/schema`; `:72` POST `/api/compress`; `:76` POST `/api/specialist`; `:79` POST `/api/warrant/issue`; `:95` POST `/api/compress`; `:97` agentrider `/api/mcp`; `:99` POST `/api/archive`, POST `/api/unarchive`; `:103` POST `/api/specialist`; `:121` POST `/api/x402-products`; `:124` `/api/compress`, `/api/decompress`; `:139` POST agentrider `/api/dm`, GET `/api/dm/{agentId}`; `:161` POST `/mcp` (card GET `/api/mcp`); `:168` POST `/api/checkout`; `:174` POST `/api/auth`; `:180` GET `/api/agent`; `:181` POST `/api/x402-products`.
**`docs/site/SKILL.md` /api/:** §3.1 table. **`docs/site/agents.txt`:** `:46-50` agentrider `/api/rider/issue`, `/api/dm`, `/api/dm/{agentId}`, `/api/mcp`; `:54-58` `/api/agent`, `/mcp`, `/api/auth`, `/api/x402-products`; `:15` warrant-month/year (no endpoint); plus GET list `:39-70`.
**`docs/site/ai.txt`:** `:11` POST `/api/x402-products`; `:13` POST `/api/dm`; `:19` x402 via POST `/api/x402-products`; `:24` PCC `$9/day…` (no endpoint); `:39` POST `/mcp`.

**Handler inventory vs openapi coverage:** `docs/site/api/` holds **65 top-level `.js` handlers** (`access-verify, agent, archive, auth, bench, benchx, box, catalog, checkout, compress, conductor, decompress, depot, discovery, duos, eval-card, feedback-submit, health, join-work, json-compress, json-decompress, license-check, livekit-token, mcp, money, olympiad, ops, payments, ppp-checkout, ppp-job, ppp-quote, process, quikgater, rent-game, residual-mint, rider, runs, sios, solana, specialist, stand, stripe-webhook, suite-folder, suite-pricing, support-onboard, tru8-chat, trugame, try-pack, try-submit, unarchive, warrant, web-codec, welcome, x-oauth-callback, x-oauth-start, x402-products, x402-suite` + test files) plus subdirs `lib/` (large), `phi/`, `rider/`, `trugame/`, `warrant/`, and `cuni-plans.json`. OpenAPI documents 11 `/api/*` paths + `/mcp`; the other ~54 handlers (e.g. `/api/archive`, `/api/decompress`, `/api/access-verify`, `/api/rider/claim`, `/api/warrant/*`, `/api/depot`, `/api/suite-pricing`, `/api/ops`, `/api/health`) have **no openapi.yaml entry**. `site/` has no `api/` directory at all.

### 3.4 WHERE the backend router lives

**In-repo: `docs/site/server.mjs` (549 lines) is the router.** It is a plain Node `http` server (`http.createServer`, server.mjs:405+):

- `REWRITES` map (server.mjs:58+) — clean URLs (`/`, `/chamber`, `/rider`, `/pcc`, `/products`, `/wiki` is **not** in the map; it resolves via directory fallback).
- Apex → www 301 (server.mjs:418-424); product-subdomain routing `acp/agentrider/cuni/gitdepot/pcc/psi.slidphilabs.com` → `subs/<product>/index.html` (server.mjs:427-435); `gone` 301 map `/gc|/aware|/tru8|/codec|/ledger|/gate|/codex|/divine-codex` → `/pcc|/specialist|/about` + receipt JSON renames (server.mjs:437-449).
- **`/v1/*` proxy** (server.mjs:445-475): exact `/v1/check|translate|squeeze|deposit|replicate` + prefix `/v1/deposit/` → `fetch((process.env.LAB_AGENT_URL || "https://spl-lab-agent.fly.dev") + pathname)`, forwarding `content-type`, `payment-signature`, `x-payment`, 90 s timeout, `Access-Control-Allow-Origin: *` on the response.
- `/healthz` + `/api/healthz` (server.mjs:476-483); `/api/nca` + `/nca` (server.mjs:485-489); `/mcp` → `/api/mcp` (server.mjs:491-494); `/api/*` → `handleApi()` (server.mjs:495-498, 351+), which loads `docs/site/api/<name>.js` or `docs/site/api/<name>/index.js` as a Vercel-style default-export handler (`loadApiHandler`, server.mjs:335-349).
- Static fallback `resolveStatic()` (server.mjs:386-404) + a blocklist returning 404 for `/lab*`, `/drverified`, `/methods.md`, `/ideas*`, `/truth*`, `/codex*`, `/server.mjs`, `/Dockerfile`, `/fly.toml` (server.mjs:499-531).
- No Express/Fastify/Cloudflare Worker in this repo — the router is hand-rolled Node `http`. No `fly.toml` or server exists for `site/`.

**External systems that serve API traffic (not in this repo):**

| Host | What it serves | Evidence |
|---|---|---|
| `agentrider.fly.dev` | Rider API (`/api/agents`, `/api/rider/issue|verify`, `/api/dm`, `/api/mcp`, `/api/toll/*`) — separate Fly app, no code in this repo | `site/docs.html:33-47`, `docs/site/llms.txt:25,54,56`, `docs/site/tollkeeper.html:106` (toll schema URL) |
| `spl-lab-agent.fly.dev` | `/v1/*` verbs (CuNi check/translate/squeeze, deposit, replicate) — proxied, **reported suspended** | `server.mjs:453` (default `LAB_AGENT_URL`); `.well-known/ai-products.json:8-11` (`store_status: suspended`, "not serving"); only reference to `LAB_AGENT_URL` in the repo is server.mjs:453 |
| `cuni-studio.fly.dev` | CuNi Studio playground + Bank | `docs/site/llms.txt:81`, `mcp.js` `cuni_bank` description |
| `quikgater-worker.ceedotrock.workers.dev` | Quikgater x402 worker (Cloudflare Worker, external) | `docs/site/quikgater.html:46`, `payments-rails.js:358` |
| `teachaid.fly.dev` | TeachAid campus app | `docs/site/teachaid.html:35`; `mcp-catalogs.mjs` surface note: "The Fly app is stopped" |

---

## 4. CHAMBER COPY (first 2–3 sentences per page + price)

| File:line | Copy (verbatim opening) | Price shown |
|---|---|---|
| `site/chamber.html:28-33` | H1 "Every action leaves a receipt." Lede: "Chamber attests agent actions with cryptographic receipts your auditors can verify without trusting us — including across key rotations." Then "Two rails: commercial tiers, enterprise agreements." | **No seat price.** Only tollkeeper chamber-seal toll "$0.02 per seal" (:33) + enterprise/DPA. Links `/pricing-usage`, `/security` (site-only targets). |
| `site/index.html:24,28` (JSON-LD only, no body copy) | Org description lists "cryptographic receipts (Chamber)"; SoftwareApplication Chamber v1.2.1, url `/chamber` | None in body |
| `site/products.html` | **No Chamber card/section in `site/products.html`** (cards are rider, cuni, teachaid; sections suite, spl-acn, gitdepot) — not found | — |
| `docs/site/chamber.html:28-32` | H1 "Signed. Stamped. Attested." Lede: "Chamber is the attested signing and attestation service behind the lab's products. Signing keys live in 600-permission files, every envelope is stamped with its custody level, and the suite is 33/33 green." | `:32` "$20/month, $200/year … 24-hour try. Opening already-sealed blobs is free forever. Sealing is not metered." |
| `docs/site/products.html:96-100` | Kicker "JSON secrets". Summary: "Chamber — Attested signing for the lab's products. Keys live in 600-permission files; every envelope is stamped with its custody level. 33/33 tests green." + "Chamber seals JSON with AES-256-GCM and a two-of-two split. Opening takes both shares. The ciphertext stays with you." | None in this section (meter strip :46-47 also no price) |
| `docs/site/index.html:115-123` | Card: "The problem: A secret in a shared system can be opened by anyone who gets one key… Why it pays: Two keys seal a JSON secret. Opening stays free once both keys meet. A business buys the seat so new seals are licensed." | Card price `$20/mo · $200/yr` (:118 region; price line in card body) |
| `docs/site/wiki/chamber.html:43,45-46,49` | H1 "Two keys. One seal. You keep the blob." Lede: "Chamber seals JSON with AES-256-GCM and a two-of-two split. Opening takes both shares. The ciphertext stays with you." "What it is": "Chamber is the seal for structured secrets: API keys, webhook URLs, configuration. The cipher is AES-256-GCM. The key is split two-of-two…" | `:49` "$20 a month or $200 a year. Sealing is not metered. A 24-hour try is free; opening already-sealed blobs is free forever. SKUs chamber-month and chamber-year." |
| `docs/site/wiki/index.html:42` | Chamber summary: "Two shares. You store the blob. $20 or $200." (group "Memory and secrets") | $20 or $200 |
| `docs/site/scripts/render-platform.mjs:240-252` (generator source for the wiki booklet) | Same H1/lede/"What it is" text as `wiki/chamber.html` (verbatim source) | Price section source: "$20 a month or $200 a year. … SKUs chamber-month and chamber-year." |
| Other Chamber descriptions | `docs/site/llms.txt:77` ("two-key JSON seal. AES-256-GCM. $20/mo · $200/yr…"); `docs/site/ai.txt:28` (same); `docs/site/lab-pass.html:39` ("Year license. Alone $200."); `docs/site/access/packs/chamber/what-ships.md:11` (table: `chamber-month` $9/30 days — stale, §2.4) | — |

**Chamber wording differences (flagged):** three incompatible framings coexist — (a) `site/chamber.html`: "attests agent actions with cryptographic receipts … across key rotations", v1.2.1, audit-in-progress, commercial tiers + enterprise/DPA, no seat price; (b) `docs/site/chamber.html` + `docs/site/products.html`: "attested signing and attestation service behind the lab's products", 600-permission key files, custody-stamped envelopes, 33/33 green, $20/$200; (c) `docs/site/wiki/chamber.html` (+ generator): "seal for structured secrets", AES-256-GCM two-of-two split, you store the blob, license = right to seal new secrets, $20/$200. (b) and (c) agree on price but describe different products in substance (signing service vs JSON seal); (a) agrees with neither on price or framing.

---

## 5. NAV + WIKI FOOTER (dead-link check by resolving each href against the live tree)

Method: for each href, checked `docs/site/<path>`, `docs/site/<path>.html`, `docs/site/<path>/index.html` (plus `server.mjs` REWRITES / `vercel.json` rewrites for `/`).

### 5.1 Primary nav — `docs/site/index.html` header (L41-47)

Brand `/` + 5 links: Shop `/` (OK), Calls `#calls` (in-page anchor), Products `#products` (in-page anchor), Pricing `/pricing` (OK → `pricing.html`), Buy `/pay` (OK → `pay.html`). **No dead links in the header nav. No `/rcrc` in the header nav.**

### 5.2 Primary nav — `site/index.html` (L65)

Single `<nav>`: `llms.txt`, `agents.json`, `platform.json`, `sitemap.xml` — all four exist in `site/`. All other `site/index.html` hrefs (`/products.html#rider|cuni|teachaid|suite|spl-acn|gitdepot`, `/pricing-usage.html`, `/signup.html`, `/login.html`, `/docs.html`, `/humans.html`, `/agents.html`, `/assets/site.css`) also resolve inside `site/`. **No dead links inside the `site/` tree itself** — the tree is self-consistent but stale and undeployed.

### 5.3 Page footer — `docs/site/index.html` (L213-222, `<footer class="wrap foot">`)

10 links: `/llms.txt` OK, `/pricing` OK, `/pay` OK, `/mcp-service` OK (`mcp-service.html`), `/silesia` OK (`silesia.html`), `/wiki` OK (`wiki/index.html`), `/about` OK, **`/privacy` MISSING** (no `docs/site/privacy.html`), **`/terms` MISSING** (no `docs/site/terms.html`), `/refund-policy` OK. **Two dead footer links on the live homepage.** Both are nevertheless listed in `docs/site/sitemap.xml:122,127` (`/privacy`, `/terms`, lastmod 2026-11-18) — the sitemap advertises pages that do not exist. No `privacy`/`terms` entry exists in `server.mjs` REWRITES or `vercel.json` rewrites.

### 5.4 Wiki footer — `docs/site/wiki/index.html:44` (and every wiki booklet, same footer)

**49 links total in the footer element** (48 from the generator's `FOOT` array in `docs/site/scripts/render-platform.mjs:23-49` + 1 `mailto:corey@slidphilabs.com`). The task's expectation of "~35 ungrouped" does not match: the actual count is **48 + mailto = 49**. All 48 resolve OK against `docs/site/` (verified by the resolver, including `/rcrc` → `docs/site/rcrc.html`, which **exists**, so `/rcrc` "Previous home" is **not** a dead link on the live tree; it is also linked from `docs/site/llms.txt:5`).

Footer links in order (grouped by apparent pillar — the footer itself is flat/ungrouped, one `<footer class="pf-foot">`):

- **Wiki/self:** SlidWiki `/wiki`, Previous home `/rcrc`
- **Core platform (a):** Rider `/rider`, CuNi `/cuni`, Warrant `/warrant`, Tollkeeper `/tollkeeper`, Chamber `/chamber`, Ring `/aos-ring`
- **Pay:** x402 `/x402`, Pay `/pay`, AwLPay `/awlpay`
- **Compression/engines:** PCC `/pcc`, TRUSTREAM `/trustream`, TNSSRC `/silesia`, pulsar `/pulsar`, ExactOdds `/exactodds`, Quikgater `/quikgater`, TRU8 `/specialist`
- **Doors/catalog:** Agents `/agents`, Humans `/humans`, Products `/products`, Pricing `/pricing`, Docs `/docs`, About `/about`, npm `/npm`, MCP `/mcp-service`, Try `/box`, Bench `/bench`, Press `/press`, Blog `/blog`, Experiments `/toys`
- **Bundle/commerce:** Lab Pass `/lab-pass`, License `/license`, Compare `/compare`, Standings `/standings`, Demos `/demos`, Olympiad `/olympiad`, Archive `/archive`, Updates `/updates`, PPS `/pps`, Sign up `/signup`, Access `/access`
- **Agent files:** llms.txt `/llms.txt`, ai.txt `/ai.txt`, agents.txt `/agents.txt`, SKILL.md `/SKILL.md`, CuNi protocol `/CUNI-PROTOCOL.md`, Status `/status`
- **Contact:** `mailto:corey@slidphilabs.com` (in the `<p>` after the links)

Wiki index body grouping (`docs/site/wiki/index.html:42`, 5 `<section>` groups): Platform (Agent Rider, CuNi, Warrant, Tollkeeper, psi, psi Org); Pay (x402, Quikgater, AwLPay); Memory and secrets (Chamber, The Ring); Engines (TNSSRC, PCC, TRUSTREAM, pulsar, TRU8); Lab bench (ExactOdds, Packages, Lab Pass). Note the body groups do not match the footer order and omit several footer items.

---

## 6. CATALOG GROUPING (current order, for the (a)/(b) split)

### 6.1 `docs/site/index.html` (live homepage) — order

1. **CuNi calls** section (`:78-96`, id `calls`): 9 priced calls in order — check $0.05, translate $0.10, ingest $0.10, money $0.25, time $0.25, parity $0.25, chain $0.50, ship $0.50, audit $1.00.
2. **"The rest of the floor"** shelf (`:98-199`, id `products`), 8 cards in order: (1) PCC compress, (2) Chamber, (3) Agent-Rider, (4) Warrant, (5) Quikgater, (6) Tollkeeper, (7) Lab Pass, (8) squeeze (PCCX, POST /v1/squeeze $0.10).
3. "What stays free" band (`:201-210`): Studio, local binary, Chamber open.

### 6.2 `docs/site/products.html` — order

- **Meter strip** (`:32-55`, 12 tiles in order): Rider, CuNi, Warrant, TNSSRC, PCC, TRUSTREAM, pulsar, Chamber, AwLPay, aos-ring, ExactOdds, TEACHAiD.
- **Detail sections** (`:60-170`): Agent-Rider (`:62`), CuNi (`:71`), Warrant (`:80`), PCC (`:89`), Chamber (`:98`); then "More from the lab" (`:104`): TNSSRC (`:110`), TRUSTREAM (`:119`), pulsar (`:128`), AwLPay (`:137`), aos-ring (`:146`), ExactOdds (`:155`), TEACHAiD (`:164`).
- **Not on this page at all:** Tollkeeper, Quikgater, Lab Pass, PSI Meter, ACP, GitDepot, TRU8/specialist (no detail sections; Tollkeeper/Quikgater/Lab Pass appear only as links elsewhere).

### 6.3 `site/index.html` — order (stale tree)

6 product rows (`:39-44`): Agent Rider, CuNi / CuNIverse, TeachAid, Hosted suite + PCC, spl-acn client, GitDepot. Then "Pricing is usage" (`:46-51`), "Doors" (`:52-62`: signup/login/docs/humans/agents).

### 6.4 `site/products.html` — order (stale tree)

3 cards: rider (`:30`), cuni (`:31`), teachaid (`:32`, with the $9 Pro price); sections: suite (`:34-38`), spl-acn (`:39-43`), gitdepot (`:44-46`). No Chamber/Warrant/Tollkeeper/Quikgater/Lab Pass sections.

### 6.5 Mapping to the requested split

- **(a) Core Infrastructure & Agent Rails** — Agent-Rider, Warrant, Tollkeeper, CuNi, Chamber, Quikgater, Lab Pass. Current homes: live homepage shelf has all 7 except CuNi is in the separate "calls" section and Tollkeeper/Lab Pass are shelf cards 6–7; `products.html` has Rider/Warrant/Chamber as details but **Tollkeeper, Quikgater, Lab Pass have no detail section** there.
- **(b) Lab R&D & Specialized Apps** — AwLPay, aos-ring, ExactOdds, TEACHAiD. Current homes: all four are "More from the lab" details on `products.html` (`:137,146,155,164`) and meter-strip tiles (`:48,50,52,54`); none is on the live homepage shelf.
- **Unassigned by the task's split (flagged):** PCC, TNSSRC, TRUSTREAM, pulsar, TRU8/specialist, PSI Meter, PSI Org, ACP, GitDepot, spl-acn client, and the CuNi hosted calls. PCC is on the homepage shelf (card 1) and is the top detail on `products.html` after Warrant; TNSSRC/pulsar/TRUSTREAM sit in "More from the lab" alongside (b) items although they are compression infrastructure. An editor applying the (a)/(b) split must decide where these eleven go; the task's two buckets do not cover them.

---

## 7. AGENT FILES

### 7.1 Sizes

| File | Bytes | Lines (approx.) |
|---|---|---|
| `site/llms.txt` | 1,460 | 26 |
| `site/agents.txt` | 836 | 21 |
| `site/llms-full.txt` | 2,322 | ~40 |
| `docs/site/llms.txt` | 20,585 | ~185 |
| `docs/site/agents.txt` | 4,160 | 76 |
| `docs/site/ai.txt` | 4,362 | 43 |
| `docs/site/SKILL.md` | 3,113 | 46 |
| `docs/site/llms-full.txt` | 5,752 | — (not enumerated line-by-line here) |
| `site/agents.json` | 1,199 | — |
| `docs/site/agents.json` | 12,515 | — |

### 7.2 `site/llms.txt` — prices: NONE; endpoints: Rider `/api/*` only; x402: NONE

- Prices: 0 `$` lines. PCC: "metered jobs. Free allowance: TBD." (`:11`); pricing link is `/pricing-usage` (`:16`) — a `site/`-only page.
- Endpoints: `:8` POST `/api/agents`, `/api/rider/issue`, `/api/rider/verify` (agentrider host); `:12` `https://www.slidphilabs.com/api/mcp`. No `/v1/`, no x402, no X-PAYMENT, no 402.

### 7.3 `site/agents.txt` — prices: NONE; endpoints: MCP + Rider; x402: NONE

- `:5-6` POST `/api/mcp` (both hosts); `:9-11` Rider register/issue/verify; `:12` JWKS; `:13` `X-Agent-Rider` header. No prices, no x402.

### 7.4 `docs/site/llms.txt` — prices: 31 `$` lines; endpoints: 25 `/api/`; x402: 6 mentions, X-PAYMENT: 2, 402: 7

- Prices: `:9,12` (Rider $12–$199); `:24` (Warrant $8/mo, $80/yr); `:30-51` SKU table (rider-solo 12, rider-team 49, rider-fleet 199, warrant-addon 8/80, chamber-month/year 20/200, pcc-meter 0.25/GB, pcc-pro/pro-year 25/250, psi-meter 25/250, psi-org 79, psi-embed-grant 490, tnssrc-grant 369, pulsar-exception 490, cuni-exception 490, cuni-check 0.05, quikgater 0.02, gitdepot-seat 15/150, teachaid-student 6/60, teachaid-pilot 2500, unified-grant 490 / founding 190 / 3+ 390, acp-certification 990, lab-pass 495); `:56` toll tools (ten, §2.3); `:59` AwLPay 0.5% / Pro $39 / L33t $799; `:72` PCC meter + Pro; `:73` TNSSRC $369; `:75` pulsar $490; `:77` Chamber $20/$200; `:78` Rider full; `:79` Warrant; `:81` CuNi $0.05/check, $490 grant; `:84` Quikgater $0.02; `:85` TeachAid $6/$60, pilot $2,500; `:86` Lab Pass $495; `:87` GitDepot $15/$150; `:88` ACP $990; `:89` PSI $25/$250; `:90` consulting $175/hr, OSS $199/yr; `:112` PCC meter; `:115` TNSSRC $369; `:121` x402; `:124` PCC meter; `:130` CuNi $490 / $0.05; `:136` Rider $12/$49/$199; `:145` AwLPay; `:151` TeachAid $6/$60.
- Endpoints: §3.3 (25 `/api/` mentions; 0 `/v1/`).
- x402/X-PAYMENT: `:20` (POST `/api/x402-products` → 402 accepts[] → X-PAYMENT → claim_token), `:51` (x402 = same sku), `:72` (x402 per-call), `:121`, `:124` (claim_token), `:181` (x402 POST `/api/x402-products`). Header line `:5` links previous home `/rcrc`.
- **Internal note:** `:163` "(seq 1-10 of the first 100 signups: 6 months, 10 GiB/mo, $25/mo …" — a truncated/legacy promo fragment inside the Q&A; amount $25/mo is not attached to a named product in that line.

### 7.5 `docs/site/agents.txt` — prices: 0 `$` lines (table uses bare numbers); endpoints: Rider + lab `/api/*`; x402: 4, X-PAYMENT: 1, 402: 5

- Prices (bare-number SKU table `:20-36`, no `$` sign, so `grep '\$'` misses it): rider-solo 12, rider-bundle 19.31, rider-crew 49, rider-shop 199, rider-fleet 199, warrant-addon 8/80, chamber-month/year 20/200, **pcc-day/month/year 9/37/369** (stale tiers, §2.8), tnssrc-grant 369, tnssrc-bakeoff 19.31, pulsar-exception 490, cuni-exception 490, lab-pass 495, foundry-plus — (no price). Header `:5` (AwLPay 0.5%), `:6` (402 OK; XPay in flight).
- Endpoints: `:10-18` quickstart; `:39-50` Rider centerpiece; `:52-70` lab GET/POST list (`/api/agent`, `/mcp`, `/api/auth`, `/api/x402-products`, `/SKILL.md`, server-card, `ai-catalog.json`, `pricing.json`, `silesia.json`, `llms-full.txt`, `ai.txt`, `/tollkeeper`, `/awlpay`, `cuni-protocol.json`, `/warrant`).
- x402: `:12,36` (POST `/api/x402-products`, "x402 resource = same sku"), `:76` ("x402 Solana+Base USDC · Stripe"); X-PAYMENT `:12`; 402: `:6,12` + header.

### 7.6 `docs/site/ai.txt` — prices: 10 `$` lines; x402: 3, X-PAYMENT: 1, 402: 3

- `:19` SKU cheat sheet (rider-solo $12 · rider-bundle $19.31 · rider-crew $49 · rider-shop $199 · rider-fleet $199 · warrant 8/80 · chamber 20/200 · **pcc day/month/year 9/37/369** · tnssrc-grant $369 · tnssrc-bakeoff $19.31/mo · pulsar-exception $490 · cuni-exception $490 · lab-pass $495 · foundry-plus); `:21` Rider seats incl. Bundle/Crew/Shop; `:22` Warrant $8/$80; `:24` PCC **$9/day · $37/mo (200 GB) · $369/yr (2 TB) — then 8¢/GB** (stale); `:25` TNSSRC $369/yr, bake-off $19.31/mo; `:27` pulsar closed embed **$369/yr** (stale, should be $490); `:28` Chamber $20/$200; `:29` Lab Pass $495; `:32` AwLPay 0.5% / Pro $39 / L33t $799.
- Endpoints: `:11` POST `/api/x402-products`; `:13` POST `/api/dm`; `:39` POST `/mcp`; `:19` x402 via POST `/api/x402-products`.
- **Note:** `:35` "TEACHAiD — campus rollout, teacher chat calls Meta Llama" — no TeachAid price in `ai.txt` (contrast `llms.txt` $6 student).

### 7.7 `docs/site/SKILL.md` — prices: 2 `$` lines, BOTH STALE; x402: 4, X-PAYMENT: 2, 402: 5

- `:9` — "Rider Solo $3.31–Fleet $631 · Warrant $37/$369 · Tollkeeper per call · Chamber $37/$369 · PCC $9/$37/$369 (board 51,498,645) · TNSSRC 43,724,575 · CuNi 0.10.0 Studio $0 · AwLPay 0.5% per payment, no fixed fee." **Every priced item in this line except TNSSRC/CuNi/AwLPay conflicts with the canonical list.** Updated 2026-10-15 (`:8`).
- `:10` — TRUSTREAM meter "first 2 GB/month free, then 8¢/GB" (stale meter, §2.8).
- `:11` — "Lab Pass: **$890/yr** = Chamber year + PCC Year + psi seat. Rider is its own seat." (stale composition + price, §2.7).
- `:19` — "Warrant: /warrant · skus warrant-month/year" (retired SKUs, §2.2); `:36` — "chamber-year, gc-month, …" (`gc-month` retired → pcc-pro).
- Endpoints: `:10` POST `/api/ppp-quote`, MCP `spl_quote`; `:14` GET `/api/agent`, server-card; `:16` POST `/api/x402-products` (+X-PAYMENT); `:18` agentrider `/api/dm`; `:24-29` Discover GETs; `:32-33` POST `/api/auth`; `:36` POST `/api/x402-products`, GET `/api/access-verify`; `:44-45` POST `/mcp`, MCP tools `spl_compress/spl_decompress/spl_zip/spl_unzip/spl_quote/spl_catalog/spl_warrant_issue/spl_warrant_verify/spl_warrant_receipt`.
- **This is the most consequential agent-file drift:** `SKILL.md` is served live at `/SKILL.md` (linked from `server.mjs` Link headers and the wiki footer) and tells agents the pre-October price schedule.

### 7.8 `docs/agent-skills/*/SKILL.md` — prices (separate skill tree, not served as site pages)

- `agent-rider/SKILL.md:23` — Rider **$79/mo · $790/yr** (SKU `rider-month`/`rider-year`), "Not in Lab Pass".
- `chamber/SKILL.md:25` — Chamber **$9/mo · $99/yr**.
- `cuni/SKILL.md:28-29,35,39` — lab-check **$0.10**, lab-translate $0.10, lab-squeeze $0.10; closed-app $490/yr.
- `pcc/SKILL.md:23,39` — Pro **$49/mo, 200 GB, 8¢/GB**; lab-squeeze $0.10.
- `slidphi-labs/SKILL.md:40-45,57` — PCC Pro $49/mo + first-2-GB/8¢; Chamber $9/$99; Rider $79/$790; Warrant $29/$290; CuNi 144 langs (vs 53); lab verbs $0.10 each.
- `teachaid-spu/SKILL.md:55-57` — school $275 one-time; curriculum review $3; Pro $9/mo.
- `warrant/SKILL.md:22` — **$29/mo · $290/yr**.
- Every figure in this tree conflicts with the live catalog except CuNi $490, lab-translate/squeeze $0.10, and AwLPay (not stated here).

### 7.9 Drift summary, `site/` vs `docs/site/` copies of the same file

- `llms.txt`: completely different documents (1,460 vs 20,585 bytes; `site/` has no prices/endpoints beyond Rider basics; `docs/site/` has the full SKU table). Not a drift — a different generation.
- `agents.txt`: completely different (836 vs 4,160 bytes; `site/` is a 21-line stub; `docs/site/` is the 76-line quickstart + SKU table).
- `llms-full.txt`: 2,322 vs 5,752 bytes; `site/llms-full.txt` states only the two $9 prices (CuNi promotion, TeachAid Pro) and "Seat amounts not stated here" for Rider MCP (`:29`); `docs/site/llms-full.txt` was not line-enumerated here.
- `agents.json`: 1,199 vs 12,515 bytes — different documents (not enumerated field-by-field here).
- `.well-known/agents.txt`: different files — `site/` 3-line stub (card + MCP URL, no prices) vs `docs/site/` 30-line allow-list with the price line `:3` (canonical figures except "1 GB/mo" wording, §2.8).
- `.well-known/ai-products.json`: differ (`diff` confirms); `docs/site/` version carries the `/v1/` verbs + suspended-store note (§3.2); `site/` version not enumerated here.

---

## 8. BUILD / LINK-CHECK TOOLING

### 8.1 Is there a build step? No (static site + Node server; no bundler, no Makefile)

- No `Makefile` at repo root or in `docs/site/`. No bundler config. The site is hand-written static HTML + `docs/site/server.mjs`.
- Root `package.json` scripts (only two): `"test": "node --test test/"`, `"mcp": "node mcp-shim.js"`. No `build`, `start`, `dev`, or `test:site`.
- `docs/site/package.json` scripts (four): `"start": "node server.mjs"`, `"dev": "node server.mjs"`, `"test": "node --test <28 named test files>"` (see §8.3), `"seo-audit": "node scripts/seo-audit.cjs"`. No `build`.
- Root `Dockerfile` only builds the MCP shim image (`node mcp-shim.js`); `docs/site/Dockerfile` only runs `node server.mjs`. Neither runs a generator.

### 8.2 `npm run test:site` is called by CI but defined NOWHERE — broken gate

- Callers: `.github/workflows/audited-checks.yml:31` (`npm run test:site`), `.github/workflows/fly-deploy.yml:39` (pre-deploy test gate: `npm ci; npm run test:site`), `.github/workflows/test.yml:40` (`npm run test:site`).
- Definition: `grep -rn '"test:site"'` over the repo (excluding `.git`/`node_modules`) returns **nothing** — no `package.json` defines it. `npm run test:site` exits non-zero ("Missing script") on a clean checkout, so the fly-deploy pre-deploy gate and both test workflows cannot pass as written. This is the single most blocking finding for edits: **the deploy gate is broken independent of any content change.** (Whether CI currently passes via some other mechanism was not verified — no CI run was inspected; the claim is strictly "the script is undefined in the repo".)

### 8.3 Tests that exist

- Root `test/`: 1 file — `test/pccz.test.mjs` (`npm test`).
- `docs/site/api/`: **114 `*.test.*` files** (count of `api/**/*.test.*` under `docs/site/api/`).
- `docs/site/package.json` `test` script names **28 files** explicitly (not the full 114): `api/lib/warrant.test.mjs`, `specialist.test.mjs`, `walk-peel.test.mjs`, `repeat-peel.test.mjs`, `x402-spent-ledger.test.mjs`, `agc-ledger.test.mjs`, `owner-gratis.test.mjs`, `tool-gate.test.mjs`, `ga4.test.mjs`, `sales-ledger.test.mjs`, `api/suite-pricing.test.mjs`, `api/lib/usage-owner.test.mjs`, `agentic-platform.test.mjs`, `acn-accounting.test.mjs`, `claim-seat.test.mjs`, `lab-auth.test.mjs`, `lab-passkeys.test.mjs`, `mcp-catalogs.test.mjs`, `nca_infra.test.mjs`, `hosted-job.test.mjs`, `pulsar-host.test.mjs`, `engines.test.mjs`, `standing-rider.test.mjs`, `sub-riders.test.mjs`, `rider-recovery.test.mjs`, `api/rider/claim.test.js`, `api/routes.test.mjs`, `api/livekit-token.test.mjs`. All 28 files exist (verified). The remaining ~86 test files are not run by any npm script found.
- `packages/spl-pay-per-suite/` has its own `test/` (run by `audited-checks.yml` "spl-pay-per-suite tests" and `npm-publish.yml`).
- No test in the repo checks prices, links, nav targets, or wiki footers (no such test file was found; `grep` for link-check tooling returned nothing).

### 8.4 Link checking: NONE. SEO audit exists but does not check links.

- Link-checker config: **not found** (no lychee/html-validate/hyperlink config; `grep -rni "link-check|broken-link|html-validate|lychee|hyperlink"` over code/config returns nothing).
- `docs/site/scripts/seo-audit.cjs` — checks only that each HTML page has charset, viewport, title, description, og:title, og:description, og:image, twitter:card, canonical. It walks `docs/site/` HTML (skipping `assets/`, `archive/`). It does **not** resolve hrefs. Invoked only by `docs/site/package.json` `seo-audit` script; no workflow calls it.
- `docs/site/scripts/smoke.mjs` — post-deploy smoke gate (called by `fly-deploy.yml` post-deploy): GET `/api/health` (200 + JSON `status`), GET `/api/agent` (200), GET `/api/x402-products` (200), POST `/api/compress` (8 zero bytes, not 5xx + JSON). No link checks.
- `docs/site/scripts/sitemap.mjs` — exists; generates sitemap (contents not verified in this audit — it was listed, not read in full). Note the sitemap it feeds lists `/privacy` and `/terms`, which have no files (§5.3).
- `docs/site/scripts/sku-price-map.mjs` — compares `PRODUCT_CATALOG` (payments-rails.js) against `docs/site/scripts/stripe-prices.json`. The manifest currently contains **only a `_note`** ("Empty: no site-catalog Price IDs exist yet (checkout builds ad-hoc price_data)") — so the manifest check would report every priced SKU as MISSING. Live Stripe check is skipped without `STRIPE_SECRET_KEY`. Not invoked by any workflow or npm script found.
- `docs/site/scripts/` full listing (18 entries): `amp/`, `backup-drill.mjs`, `curl_zrw_10k.sh`, `duos-shopper.mjs`, `hosted_bench.mjs`, `mcp-card.mjs`, `refresh-lb-from-lbr1.sh`, `render-platform.mjs`, `seo-audit.cjs`, `seo-blitz.mjs`, `silesia_rank.py`, `sitemap.mjs`, `sku-price-map.mjs`, `slid_verify_deploy.sh`, `slid_watch_pulse.mjs`, `smoke.mjs`, `stripe-prices.json`, `watch_dns_to_fly.sh`.

### 8.5 `render-platform.mjs` invokers: NONE

- `grep -rn "render-platform"` over the repo (excluding `.git`/`node_modules`) returns exactly two hits: the file's own header comment (`docs/site/scripts/render-platform.mjs:3` — "Run: node scripts/render-platform.mjs") and a manifest entry in `docs/slidphiclepedia/corpora/manifest.jsonl:643` (a content hash, not an invocation).
- **No** `package.json` script, `Makefile`, workflow, shell script, or other JS file invokes it. It is run manually or not at all. It writes `wiki/<slug>.html` + `wiki/index.html` in place under `docs/site/` (render-platform.mjs:138-140 `write()`; `:463-465` page render; `:27` `write("wiki/" + page.slug + ".html", …)`; `:52` `write("wiki/index.html", …)`), with `NAV` (8 entries, `:12-21`) and `FOOT` (48 entries, `:23-49`), and the footer template at `:97` appends "© 2026 Slid Phi Labs, Inc" (the known footer-drift item — the checked-in wiki footers do not all carry that string; not re-verified line-by-line here).

### 8.6 How to verify zero broken internal links WITHOUT running the renderer

The method used for §5 of this audit, reproducible without any generator:

1. Collect every internal `href`/`src` from `docs/site/**/*.html` (plus `llms.txt`/`agents.txt`/`ai.txt`/`SKILL.md` link targets).
2. Resolve each against the live root `docs/site/`, trying `<path>`, `<path>.html`, `<path>/index.html`, plus the `REWRITES` map in `docs/site/server.mjs:58+` and the `rewrites`/`redirects` in `docs/site/vercel.json` (for reference only — Vercel is disabled; `server.mjs` is authoritative).
3. Report any target with no file. (This audit did that for the two navs + wiki footer + homepage footer; it did **not** run a whole-site link sweep — that sweep is the recommended next step, not a result claimed here.)
4. Additionally: run `node --test` per `docs/site/package.json` (28 files) and `npm test` at root; run `node docs/site/scripts/seo-audit.cjs` for meta completeness; run `node docs/site/scripts/smoke.mjs <base-url>` against a running server (it needs a live base URL, not the renderer).

---

## 9. MCP — tool schemas in this repo

### 9.1 Canonical MCP server: `docs/site/api/mcp.js` (POST `/mcp` or `/api/mcp`; GET returns the server card)

Server name `slid-phi-labs`, version `1.21.0` (mcp.js:18). Total tools served: **25** = 16 `COMMERCE` + 6 catalog + 3 agentic.

**COMMERCE (16, `docs/site/api/mcp.js`):**

| Tool | Endpoint / price reference in its description or code |
|---|---|
| `cuni_bank` (:20) | Calls CuNi Studio (`cuni-studio.fly.dev`); exactness/Bank translation; no price in description |
| `spl_discover` (:34) | Static discovery map; no price |
| `spl_lab_auth` (:35) | Auth instructions; no price |
| `spl_signup` (:37) | Creates human account; no price |
| `spl_agent_key` (:51) | Mints `spl_ag_*` key; no price |
| `spl_catalog` (:61) | "List the standing SKUs agents can buy via x402 (live product list from /api/x402-products)"; returns current prices |
| `spl_compress` (:63) | "Metered: first 1 GB free once per IP, then $0.25/GB; a paid seat or x402 payment may be required (402)" |
| `spl_decompress` (:73) | No price |
| `spl_zip` (:83) | No price (`.pcc` archive) |
| `spl_unzip` (:106) | No price |
| `spl_quote` (:116) | "First 1 GB free once per IP, then $0.25/GB of input, $1 card minimum" |
| `spl_warrant_issue` (:130) | Warrant mint; spend cap; no price |
| `spl_warrant_verify` (:147) | No price |
| `spl_warrant_reserve` (:161) | Pre-spend cap; no price |
| `spl_warrant_receipt` (:186) | Settles USD cost; no price |
| `spl_warrant_release` (:175) | Refund reservation; no price |

**Catalog tools (6, `docs/site/api/lib/mcp-catalogs.mjs:200-229`, categories `sku`/`license`/`surface` at :1-50):** `sku_search`, `sku_get`, `license_search`, `license_get`, `surface_search`, `surface_get`. The `sku` catalog entries carry the canonical prices (e.g. `:15-16` chamber-month `$20/mo`, chamber-year `$200/yr`; `:17-18` pcc-pro `$25/mo`, pcc-pro-year `$250/yr`; `:19-21` rider-solo `$12/mo`, rider-team `$49/mo`, rider-fleet `$199/mo`; `:22-23` rider-ops-month `$37/mo`, rider-ops-year `$369/yr`; `:24` suite "1 GB free once per IP, then $0.25/GB"; `:25` lab-pass `$495/yr`; `:26` consulting `$350`; `:27` oss-support `$199`; `:12-14` cuni $0, cuni-exception $490/yr, pulsar-exception $490/yr). Note the `surface` catalog's teachaid entry says "The Fly app is stopped."

**Agentic tools (3, `docs/site/api/lib/agentic-platform.mjs:1769+`):** `spl_agentic_plan` (:1771), `spl_agentic_context` (:1816), `spl_agentic_run` (:1835). No prices in their names; dispatch via `dispatchAgentic` (imported in mcp.js:13).

**Server card:** `docs/site/.well-known/mcp/server-card.json` — name `slid-phi-labs`, version `1.21.0`, transport streamable-http `https://www.slidphilabs.com/mcp`, description notes "first 1 GB/month free, then $0.25/GB" (monthly wording — see §2.8). `site/.well-known/mcp/server-card.json` differs (not enumerated here).

### 9.2 MCP shim (client side): `mcp-shim.js` (repo root)

- No tool schemas of its own: it is a stdio→HTTP proxy. Upstream `https://www.slidphilabs.com/mcp` (override `SLIDPHI_MCP_URL`), optional `SLIDPHI_API_KEY` → `Authorization: Bearer <redacted>` It forwards `tools/list` + `tools/call` verbatim (mcp-shim.js:49-65) and warms the tool list at startup (:67-68). Version `1.20.2` (mcp-shim.js:26) vs server `1.21.0`. Published as the `slid-phi` npm package (`bin: slidphi-mcp`, root `package.json`) and via root `Dockerfile` (`CMD ["node", "mcp-shim.js"]`).

### 9.3 Other MCP surfaces

- `packages/spl-pay-per-suite/src/` tools (separate npm package, own MCP server): `spl_compress`, `spl_decompress`, `spl_lab_auth`, `spl_pps_checkout`, `spl_pps_classify`, `spl_pps_info`, `spl_pps_quote`, `spl_pps_submit_job`, `spl_pps_x` (9 tool names found by grep; descriptions/prices not enumerated here).
- `docs/site/api/mcp.js` also references `spl_quote` (MCP) vs `POST /api/ppp-quote` (HTTP) — same quote, two surfaces.
- `docs/site/SKILL.md:45` lists MCP tools as `spl_compress / spl_decompress / spl_zip / spl_unzip / spl_quote / spl_catalog / spl_warrant_issue / spl_warrant_verify / spl_warrant_receipt` — matches `COMMERCE` except it omits `spl_discover`, `spl_lab_auth`, `spl_signup`, `spl_agent_key`, `spl_warrant_reserve`, `spl_warrant_release`, `cuni_bank`, and all catalog/agentic tools. The list is incomplete, not wrong.
- Registry: `io.github.ceedot-rock/slid-phi-labs` (server-card, SKILL.md:46); publish workflow `.github/workflows/publish-mcp.yml` publishes `packages/spl-pay-per-suite/server.json` via `mcp-publisher`.

---

## 10. WHAT BLOCKS EDITS (summary for the editor)

1. **`npm run test:site` is undefined** (§8.2) — the fly-deploy pre-deploy gate and two test workflows call a script no `package.json` defines. Fix the script (or the workflows) before trusting any deploy gate.
2. **Two live trees, one live.** Edit `docs/site/` only. `site/` is an undeployed snapshot; editing it changes nothing live, and its prices ($9 TeachAid Pro, $9 CuNi promotion, no Chamber price) will re-confuse any future diff. Decide explicitly whether to delete `site/` or keep it as an archive — do not edit both.
3. **Stale-price blast radius is large but mechanical:** the Chamber-year $369 button sits in 30 files (same snippet, likely one shared header — verify before hand-editing 30 files); the stale `agent-one-liner` meta sits in ~6–8 files; `SKILL.md` (live at `/SKILL.md`) and `docs/agent-skills/` carry the full pre-October schedule and need a wholesale rewrite, not line edits.
4. **Three decisions only the owner can make (do not guess):** (a) TeachAid $9 Pro vs $6 student — tier naming; (b) PCC free window — "once per IP, lifetime" (`pricing.html`, catalog) vs "each month" (`pcc.html`, `wiki/pcc.html`, server-card, `.well-known/agents.txt`); (c) Toll 5 exactness $0.10 (`tollkeeper.html`) vs $0.05 (wiki, llms, index card, ten-tool list).
5. **`/v1/*` proxies to a suspended app** (`spl-lab-agent.fly.dev` per `.well-known/ai-products.json:8-11`) — the live homepage advertises POST `/v1/squeeze` ($0.10) while the upstream is reported not serving. Verify live before touching `/v1/` copy.
6. **Dead links on the live homepage footer:** `/privacy`, `/terms` (no files; sitemap lists them anyway). `/rcrc` is fine (file exists).
7. **Do not regenerate the wiki** (`render-platform.mjs`) until the price decisions in (4) are made — the generator's FOOT array (48 links) and its hard-coded price strings would re-emit current values, and its footer template appends "© 2026 Slid Phi Labs, Inc" (known drift item per lab notes). The generator currently has **zero** invokers (§8.5), so nothing will regenerate it by accident.
8. **No link checker exists.** A whole-site internal-link sweep (method in §8.6) has not been run; this audit checked only the navs, homepage footer, and wiki footer. Run the sweep before calling the site consistent.
9. **App-name drift:** `spl-slidphilabs` (fly.toml, deploy workflow) vs `slidphilabs` (FLY_PUBLIC.md, DNS_TO_FLY.md, server.mjs default). Pick one string for docs.
10. **Stripe price manifest is empty:** `docs/site/scripts/stripe-prices.json` holds only a note; `sku-price-map.mjs` would report every priced SKU missing. If Stripe Price IDs are meant to exist, that is a separate gap from the page copy.
