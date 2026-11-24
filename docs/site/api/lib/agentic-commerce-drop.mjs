/**
 * Agentic Commerce Drop — the sell-to-agents package over the unified
 * payment gateway (lib/payment-gateway.mjs).
 *
 * What the drop does:
 *   1. Auto-routes: orders the 402 accepts[] by what can actually
 *      settle this amount (card rails drop out below the settlement
 *      floor; pre-approved AP2 mandates and x402 crypto lead), and
 *      dispatches a retry to the rail its credential belongs to.
 *   2. Configures: reports per-rail readiness (booleans + missing env
 *      NAMES only, never values) and generates the env template +
 *      fly secrets commands an operator pastes to turn a rail on.
 *
 * The drop never invents prices: every charge is the catalog price
 * from payments-rails (PRODUCT_CATALOG via priceForSku).
 */
import {
  configuredProtocols,
  priceForSku,
  issueChallenge,
  consumeChallenge,
  detectProtocol,
  checkPolicy,
  releasePolicy,
  settleX402,
  settleStripeRail,
  settleAp2,
  gatewayReceipt,
  cardFloorCents,
} from "./payment-gateway.mjs";

export const DROP_VERSION = "1.0.0";
export const DROP_NAME = "Agentic Commerce Drop";

const RAIL_REQUIREMENTS = {
  x402: {
    label: "x402 (Solana USDC)",
    env: ["X402_PAY_TO"],
    enable: "Set X402_PAY_TO to the lab Solana USDC recipient. Base x402 settles on /api/x402-suite.",
  },
  mpp: {
    label: "MPP (Stripe Shared Payment Token)",
    env: ["STRIPE_SECRET_KEY", "GW_MPP_ENABLED=1"],
    enable: "Enroll in Stripe machine payments, set STRIPE_SECRET_KEY, then GW_MPP_ENABLED=1.",
  },
  acp: {
    label: "ACP (delegated payment token)",
    env: ["STRIPE_SECRET_KEY", "GW_ACP_ENABLED=1"],
    enable: "Enable delegated checkout in Stripe, set STRIPE_SECRET_KEY, then GW_ACP_ENABLED=1.",
  },
  ap2: {
    label: "AP2 (signed mandate)",
    env: ["AP2_ISSUER_PUBLIC_KEY", "GW_AP2_MERCHANT_ID"],
    enable: "Publish the mandate issuer public key (PEM) as AP2_ISSUER_PUBLIC_KEY and set GW_AP2_MERCHANT_ID.",
  },
};

function envSet(name, env) {
  if (name.endsWith("=1")) {
    const k = name.slice(0, -2);
    return env[k] === "1";
  }
  // The restricted key satisfies the Stripe credential requirement.
  if (name === "STRIPE_SECRET_KEY") return Boolean(env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY);
  return Boolean(env[name]);
}

/** Per-rail readiness. Booleans and missing env names only. */
export function railReadiness(env = process.env) {
  const configured = new Set(configuredProtocols(env));
  const rails = {};
  for (const [protocol, req] of Object.entries(RAIL_REQUIREMENTS)) {
    const missing = req.env.filter((name) => !envSet(name, env));
    rails[protocol] = {
      label: req.label,
      configured: configured.has(protocol),
      missing,
      enable: req.enable,
    };
  }
  return rails;
}

/** Copy-paste env template + fly commands to configure the new rails. */
export function configTemplate(env = process.env) {
  const readiness = railReadiness(env);
  const lines = [
    "# Agentic Commerce Drop — rail configuration",
    "# Values are secrets: set them in the Fly app, never commit them.",
    "",
    "# x402 (already live when X402_PAY_TO is set)",
    "X402_PAY_TO=",
    "SOLANA_RPC_URL=https://api.mainnet-beta.solana.com",
    "",
    "# MPP — Stripe Shared Payment Tokens",
    "STRIPE_SECRET_KEY=",
    "GW_MPP_ENABLED=1",
    "",
    "# ACP — delegated payment tokens (shares the Stripe key)",
    "GW_ACP_ENABLED=1",
    "",
    "# AP2 — signed mandates (public key is not a secret)",
    "AP2_ISSUER_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----",
    "GW_AP2_MERCHANT_ID=",
    "",
    "# Guardrails",
    "GW_MIN_CARD_SETTLE_CENTS=50",
    "GW_REQUIRE_RIDER=0",
  ];
  const missing = Object.values(readiness).flatMap((r) => r.missing);
  const commands = [
    "fly secrets set STRIPE_SECRET_KEY=<key> GW_MPP_ENABLED=1 GW_ACP_ENABLED=1 -a spl-slidphilabs",
    "fly secrets set AP2_ISSUER_PUBLIC_KEY=<pem> GW_AP2_MERCHANT_ID=<merchant> -a spl-slidphilabs",
    "fly secrets set X402_PAY_TO=<solana-usdc-recipient> -a spl-slidphilabs",
  ];
  return { template: lines.join("\n"), commands, missing_env: [...new Set(missing)], readiness };
}

/**
 * Order candidate rails for an amount. Credential-bound retries stick
 * to their own rail. Otherwise: AP2 (pre-approved) and x402 lead;
 * card rails only appear at or above the card settlement floor.
 */
export function chooseRails({ amount_cents, credentialProtocol = null, env = process.env } = {}) {
  const configured = configuredProtocols(env);
  if (credentialProtocol) {
    return configured.includes(credentialProtocol) ? [credentialProtocol] : [];
  }
  const order = [];
  if (configured.includes("ap2")) order.push("ap2");
  if (configured.includes("x402")) order.push("x402");
  if (amount_cents >= cardFloorCents(env)) {
    if (configured.includes("mpp")) order.push("mpp");
    if (configured.includes("acp")) order.push("acp");
  }
  return order;
}

/** Challenge with accepts reordered by the router's preference. */
export function routedChallenge({ sku, amount_cents, env = process.env }) {
  const challenge = issueChallenge({ sku, amount_cents, env });
  const preference = chooseRails({ amount_cents, env });
  challenge.accepts.sort((a, b) => preference.indexOf(a.protocol) - preference.indexOf(b.protocol));
  challenge.routed_accepts = preference;
  challenge.drop = { name: DROP_NAME, version: DROP_VERSION };
  return challenge;
}

/**
 * Full routed payment: price → policy → nonce → settle → receipt.
 * adapters/fetchImpl are injectable for tests, same as the gateway.
 */
export async function executeDropPayment({ req, body, env = process.env, fetchImpl = globalThis.fetch, adapters = {} } = {}) {
  const priced = priceForSku(body && body.sku);
  if (!priced) return { status: 404, body: { ok: false, error: "unknown_or_unpriced_sku" } };
  const { sku, amount_cents } = priced;

  const protocol = detectProtocol({ headers: (req && req.headers) || {}, body: body || {} });
  if (!protocol) {
    if (!body || !body.nonce) return { status: 402, body: routedChallenge({ sku, amount_cents, env }) };
    return { status: 400, body: { ok: false, error: "unrecognized_payment_credential" } };
  }

  const candidates = chooseRails({ amount_cents, credentialProtocol: protocol, env });
  if (!candidates.length) {
    return { status: 503, body: { ok: false, error: "protocol_not_configured", protocol, routed_accepts: chooseRails({ amount_cents, env }) } };
  }

  const policy = await checkPolicy({ req, amount_cents, env, fetchImpl });
  if (!policy.ok) return { status: policy.status || 403, body: { ok: false, error: policy.reason } };

  const consumed = consumeChallenge({ nonce: body.nonce, sku, amount_cents, env });
  if (!consumed.ok) {
    releasePolicy(policy.reservation);
    return { status: 402, body: { ok: false, error: consumed.reason } };
  }

  let settled;
  try {
    if (protocol === "x402") {
      const signature = body.signature || body.tx || (body.payload && body.payload.signature) || "";
      settled = await settleX402({ signature, sku, amount_cents, env, adapters });
    } else if (protocol === "mpp" || protocol === "acp") {
      const credential = ((req && req.headers) || {})["payment-credential"] || body.payment_credential || body.delegated_token || "";
      settled = await settleStripeRail({ protocol, credential, sku, amount_cents, nonce: body.nonce, env, fetchImpl });
    } else {
      settled = settleAp2({ mandate: body.mandate, sku, amount_cents, nonce: body.nonce, env });
    }
  } catch (e) {
    releasePolicy(policy.reservation);
    return { status: 502, body: { ok: false, error: "settle_failed", detail: String((e && e.message) || e) } };
  }

  if (!settled.ok) {
    releasePolicy(policy.reservation);
    const status = settled.reason === "protocol_not_configured" ? 503 : settled.reason === "already_used" ? 409 : 402;
    return { status, body: { ok: false, error: settled.reason, protocol, routed_accepts: chooseRails({ amount_cents, env }) } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      settled: true,
      drop: { name: DROP_NAME, version: DROP_VERSION },
      rail: protocol,
      routed: true,
      sku,
      amount_cents,
      receipt: gatewayReceipt({ protocol, sku, amount_cents, settled_id: settled.settled_id, nonce: body.nonce }),
    },
  };
}

export function dropManifest(env = process.env) {
  return {
    ok: true,
    name: DROP_NAME,
    version: DROP_VERSION,
    tagline: "Sell to agents on every major payment rail from one 402.",
    endpoint: "/api/agentic-commerce-drop",
    rails: railReadiness(env),
    buy_flow: [
      "POST /api/agentic-commerce-drop { sku } → routed 402 (accepts ordered for this amount)",
      "Agent retries with the challenge nonce + one credential (x402 tx, spt_ token, delegated token, or AP2 mandate)",
      "Gateway checks Rider/Warrant policy, settles the exact catalog price, returns a signed receipt",
    ],
    config: "GET /api/agentic-commerce-drop?view=config returns readiness + env template (names only, no secrets)",
    pricing: "Charges are catalog prices (payments-rails PRODUCT_CATALOG). The drop adds no markup field of its own.",
  };
}
