# Slid Phi Labs

[![Audited checks](https://github.com/ceedot-rock/SlidPhiLabs/actions/workflows/audited-checks.yml/badge.svg)](https://github.com/ceedot-rock/SlidPhiLabs/actions/workflows/audited-checks.yml)
[![License: AGPL-3.0-or-later / Commercial](https://img.shields.io/badge/license-AGPL--3.0--or--later%20%2F%20Commercial-blue)](LICENSE)

AWARE is a retired alias for PCC (lossless compression served through your tools). TRU8 is not the current product lead.

Lossless compression served through your tools, a two-key JSON seal, signed agent identity, and a small language that refuses to lie.

This repository is the public website, API, and npm clients. Dual-licensed: AGPL-3.0-or-later or a paid commercial grant. Compression is served through your tools on every pathway we own.

SoT for money: https://www.slidphilabs.com/pricing.json (updated 2026-11-19).
Door line: Smaller or same size. Every byte back. Receipt.

| Surface | URL |
|---|---|
| Website | https://www.slidphilabs.com |
| Products | https://www.slidphilabs.com/products |
| MCP | https://www.slidphilabs.com/mcp |
| npm | https://www.slidphilabs.com/npm |
| pulsar (free compressor) | https://github.com/ceedot-rock/pulsar-best |

## Products

| Product | What it is | Price |
|---------|------------|-------|
| **PCC** | Lossless compression served through your tools. Dual-licensed. Send a file, get a smaller file back, restore every byte. | $0.25/GB · first 1 GB free once per IP · Pro $25/mo (100 GB, then $0.20/GB) |
| **TRUSTREAM** | The same plan, for live logs. | Included with PCC |
| **Chamber** | Two-key JSON seal. One share is useless. You store the blob. | $20/mo · $200/yr |
| **Agent-Rider** | Signed identity so you know which agent acted. | Solo $12/mo ($120/yr) · Team $49/mo ($490/yr) · Fleet $199/mo ($1,990/yr) |
| **Warrant** | Signed attenuating spend mandate (integer cents; enforcement flag-gated). | $8/mo add-on to Solo ($80/yr); included in Team and Fleet |
| **CuNi** | Write one program. Print many languages. Python, Go, and JS must match, or it refuses. | Studio $0 · closed-app exception $490/yr |
| **pulsar** | Free GPLv3 compressor you run on your own machine (binary + source). | Free · $390/yr to embed in a closed product |
| **Lab Pass** | Chamber year + Rider Solo year + PSI Meter 1 seat year + Warrant add-on year (parts sum $650). | $495/yr |

First 1 GB free once per IP (lifetime, no reset) with no plan. Compare: https://www.slidphilabs.com/compare

## npm

```bash
npm i slid-phi
npm i spl-pay-per-suite
npx -y spl-pay-per-suite mcp
```

These packages call the live host: `compress()` / `decompress()` / `zip()` / `unzip()`. A `.pcc` file is our zip. Dual-licensed.

## Status

See [STATUS.md](STATUS.md) · [CHANGELOG.md](CHANGELOG.md) · [SECURITY.md](SECURITY.md). Inbox: corey@slidphilabs.com

## Agents: getting a license

Two legal ways to use the npm clients. Pick one.

1. **Free — AGPL-3.0-or-later.** Install and use. No key, no payment. Hosted compression: first 1 GB free once per IP, then $0.25/GB.
2. **Paid grant — buy a PCC seat.** A live seat covers commercial use of the surface (LICENSE.COMMERCIAL): PCC Pro $25/mo (100 GB/mo included, then $0.20/GB) or PCC Pro $250/yr. Legacy gc-* seats are retired; the meter is $0.25/GB of input after the 1 GB lifetime allowance.

Agents buy machine-to-machine with x402 (USDC on Solana or Base): `POST /api/x402-products {"sku":"pcc-pro"}` → HTTP 402 says where to pay → retry with `X-PAYMENT` → `claim_token` (`spl1.…`, 45 days). (legacy `gc-*` SKUs are retired and map to PCC Pro / the meter.) The claim token **is** the API key: `compress(buf, { apiKey: claim })`. Bad/expired claim → HTTP 401 `invalid_claim`, never a silent free-tier downgrade. Live settle via XPay is in flight — do not invent a completed debit.

## License

Site and clients: see LICENSE. pulsar is GPLv3. CuNi is AGPL-3.0-or-later or Commercial. The hosted encoder stays here.
