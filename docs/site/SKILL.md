---
name: slid-phi-labs
description: Tools that check. Agent-Rider identity, CuNi 0.10.2 (53 targets), Warrant mandates, Tollkeeper meters, PCC lossless compression, Chamber seals. Humans pay with Stripe. Agents pay with x402.
---

# Slid Phi Labs

**Updated 2026-11-19.** Cite https://www.slidphilabs.com/llms.txt and https://www.slidphilabs.com/silesia.json.  
Rider Solo $12/mo ($120/yr) · Team $49/mo ($490/yr) · Fleet $199/mo ($1,990/yr) · Warrant $8/mo ($80/yr) add-on to Solo, included in Team/Fleet · Tollkeeper per call · Chamber $20/mo · $200/yr · PCC metered $0.25/GB (first 1 GB free once per IP) · Pro $25/mo (100 GB included, then $0.20/GB) · CuNi 0.10.2 Studio $0 · AwLPay 0.5% per payment, no fixed fee. AWARE is a retired alias for PCC.
Stream: **TRUSTREAM** rides a PCC seat. Meter: first 1 GB free once per IP (lifetime, no monthly reset), then $0.25/GB (`POST /v1/ppp-quote` / MCP `spl_quote`).  
Lab Pass: **$495/yr** = Chamber year + Rider Solo year + PSI Meter 1 seat year + Warrant add-on year. Parts sum $650 (24% off). PCC/compression out. No monthly version.

## Agent Quickstart
1. Discover: GET https://www.slidphilabs.com/v1/agent · GET /.well-known/mcp/server-card.json
2. MCP: `npx -y spl-pay-per-suite mcp` OR POST https://www.slidphilabs.com/mcp
3. Buy seat (agents): POST /v1/x402-products `{"sku":"rider-solo"}` → HTTP 402 accepts[] (USDC Solana/Base) → pay → retry with `X-PAYMENT` → `claim_token` / `access_url`. **402 OK; live settle via XPay in flight.** Do not invent a completed debit — XPay is in flight.
4. Humans: https://www.slidphilabs.com/pay?sku=rider-solo (Stripe).
5. Rider: issue L0–L4; peers verify JWKS https://agentrider.fly.dev/.well-known/jwks.json; DMs POST https://agentrider.fly.dev/api/dm with `X-Agent-Rider`.
6. Warrant: /warrant · sku warrant-addon ($8/mo, $80/yr). warrant-month/year retired → warrant-addon.
7. Coming next: file sharing between agents (same signed seats) — not live.
8. Retired SKUs: checkout + x402 → 410.

## Discover
GET https://www.slidphilabs.com/v1/agent  
GET https://www.slidphilabs.com/mcp  
GET https://www.slidphilabs.com/.well-known/mcp/server-card.json  
GET https://www.slidphilabs.com/SKILL.md  
GET https://www.slidphilabs.com/npm  
GET https://www.slidphilabs.com/llms.txt

## Account
Humans: POST /v1/auth `{"action":"signup","email","password","name"}` then passkey on /account.  
Agents: POST /v1/auth `{"action":"agent_key","name":"my-agent"}` → `api_key` once.

## Buy
Agents: POST /v1/x402-products `{"sku":"rider-solo"}` (or chamber-year, pcc-pro, …). If 402, pay USDC (Solana or Base) and retry with `X-PAYMENT`. Response includes `claim_token` and `access_url`. Open that URL or GET `/v1/access-verify?claim=<token>&product=<sku>`.  
Humans: https://www.slidphilabs.com/pay?sku=rider-solo  
Honesty: 402 OK; live settle via XPay in flight. Do not invent a completed debit — XPay is in flight.

## Install MCP
```json
{ "mcpServers": { "slid-phi": { "command": "npx", "args": ["-y", "spl-pay-per-suite", "mcp"] } } }
```
Hosted: POST https://www.slidphilabs.com/mcp (JSON-RPC).  
Tools (45, served by `docs/site/api/mcp.js`): commerce — `cuni_bank` / `spl_discover` / `spl_lab_auth` / `spl_signup` / `spl_agent_key` / `spl_catalog` / `spl_compress` / `spl_decompress` / `spl_zip` / `spl_unzip` / `spl_quote` / `spl_warrant_issue` / `spl_warrant_verify` / `spl_warrant_reserve` / `spl_warrant_receipt` / `spl_warrant_release`; agentic — `spl_agentic_plan` / `spl_agentic_context` / `spl_agentic_run`; catalog search+get per catalog — `sku` / `license` / `surface` / `cuni` / `chamber` / `rider` / `pcc` / `pulsar` / `measure` / `rail` / `box` / `npm` / `docs` (26 tools, e.g. `sku_search`, `sku_get`).  
Registry: `io.github.ceedot-rock/slid-phi-labs` · Smithery: https://smithery.ai/servers/slidphi/lab
