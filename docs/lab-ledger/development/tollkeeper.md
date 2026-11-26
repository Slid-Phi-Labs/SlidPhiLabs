# Tollkeeper — development

Updated 2026-11-26. Source: `/tollkeeper`, `pricing.json` (no separate Tollkeeper SKU block), TOP100 #59.

## One sentence (TOP100 #59)

**Tollkeeper is Rider’s metered protection shelf — ten live tools with posted prices and signed receipts (plus a seven-crossing map that is not a second bill) — so agents pay small, honest tolls at chokepoints instead of guessing.**

## Live tools + pricing honesty

- **Page:** https://www.slidphilabs.com/tollkeeper
- **Schema:** https://agentrider.fly.dev/api/toll/schema
- **Posted tool prices (from the live page; not a separate `pricing.json` product object):** verify $0.02 · notarize $0.01 · exactness $0.05 · draw $0.01 · resolve $0.02 · CuNi proof $0.10 · Chamber seal $0.02 · AwLPay quote $0.005 · compress / TRUSTREAM pack $0.01 per MB (min $0.001). Caller without a Rider key → 401. Sandbox bearer `sk_sandbox_demo` validates with zero side effects.
- **Honesty:** Do not invent a Tollkeeper seat SKU. Quote the tool figures above (or the live schema). Rider seats remain the access key (Solo $12 / Team $49 / Fleet $199 per `pricing.json`).

## History

- 2026-11-26: TOP100 #59 — one-sentence what/why + live pointer filed.
- 2026-10-08: ten live metered tools section.
- 2026-09-28: open-highway + protection framing.
