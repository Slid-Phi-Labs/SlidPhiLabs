# AgentHQ activate E2E (operator)

Live money. Only run when Corey is ready to charge a real card (or refund after).

## Preconditions

- Fly `spl-slidphilabs` serves `/hq` and `/api/hq` (verified).
- Stripe product `spl_hq`, price `price_1UfxcLLehTFD59CGBhLOr1Cl`, lookup `spl_hq_month`.
- App secret: `STRIPE_RESTRICTED_KEY` (or `STRIPE_SECRET_KEY`) on Fly.

## Steps

1. Open https://www.slidphilabs.com/hq (fallback https://spl-slidphilabs.fly.dev/hq).
2. Claim an unused name + email → redirected to Stripe Checkout (`cs_live_…`).
3. Pay $29.99 → return `?paid=1&session_id=cs_live_…` (URL query scrubbed after activate).
4. Page activates; **copy the one-time management token** (shown once); Open your HQ.
5. Load settings with name + token; toggle PSI preference; Save.
6. Confirm status: `GET /api/hq?action=status&name=<slug>` → `exists:true`, `active:true`.

## Cancel path

Abort Checkout → return `?cancel=1` → chip “Checkout cancelled · no charge”.

## Fail-closed

Without a Stripe secret on Fly, create returns `503 no_key` and charges nothing.

## Cleanup

- Cancel the Stripe subscription in Dashboard if the claim was only a probe.
- Do not commit management tokens or paste them on the mesh bus / DEMO recording.
