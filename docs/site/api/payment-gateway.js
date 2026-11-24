/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Unified agent payment gateway — one 402, every configured rail.
 *
 *   GET  /api/payment-gateway            → discovery (protocols + rails)
 *   POST /api/payment-gateway { sku }    → 402 unified challenge
 *   POST /api/payment-gateway { sku, nonce, ...credential }
 *        → policy (Rider/Warrant) → exact-price settle → receipt
 *
 * Protocols: x402 (Solana USDC, live here; Base stays on
 * /api/x402-suite), mpp + acp (Stripe capture when enabled),
 * ap2 (signed mandate when an issuer key is configured).
 * Unconfigured rails are never advertised and always fail closed.
 * See lib/payment-gateway.mjs for the guardrail order.
 */
import "./lib/prod-guard.mjs";
import { paidCors } from "./lib/cors.mjs";
import {
  GATEWAY_VERSION,
  priceForSku,
  configuredProtocols,
  issueChallenge,
  consumeChallenge,
  detectProtocol,
  checkPolicy,
  releasePolicy,
  settleX402,
  settleStripeRail,
  settleAp2,
  gatewayReceipt,
} from "./lib/payment-gateway.mjs";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** Default Solana RPC adapter for x402 receipt verification. */
function solanaAdapters(env = process.env) {
  const url = env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return {
    getTransaction: async (signature) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
        }),
      });
      const data = await r.json().catch(() => ({}));
      return data && data.result ? data.result : null;
    },
  };
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return {};
}

export default async function handler(req, res) {
  paidCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      gateway: GATEWAY_VERSION,
      endpoint: "/api/payment-gateway",
      protocols: configuredProtocols(),
      rails: {
        x402: "Solana USDC exact (Base via /api/x402-suite)",
        mpp: process.env.GW_MPP_ENABLED === "1" ? "stripe (enabled)" : "stripe (not enabled)",
        acp: process.env.GW_ACP_ENABLED === "1" ? "stripe (enabled)" : "stripe (not enabled)",
        ap2: process.env.GW_AP2_MERCHANT_ID ? "signed mandate" : "not configured",
      },
      flow: [
        "POST { sku } → 402 challenge with accepts[] + single-use nonce",
        "Retry with the same nonce + one protocol credential",
        "Policy (Rider/Warrant) → exact-price settle → signed receipt",
      ],
    });
  }

  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = parseBody(req);
  if (body === null) return json(res, 400, { error: "Invalid JSON" });

  const priced = priceForSku(body.sku);
  if (!priced) return json(res, 404, { ok: false, error: "unknown_or_unpriced_sku", sku: body.sku || null });
  const { sku, amount_cents } = priced;

  // No credential yet → unified 402 challenge.
  const protocol = detectProtocol({ headers: req.headers, body });
  if (!protocol) {
    if (!body.nonce) return json(res, 402, issueChallenge({ sku, amount_cents }));
    return json(res, 400, { ok: false, error: "unrecognized_payment_credential" });
  }

  // Guardrail 1: identity + policy before any money moves.
  const policy = await checkPolicy({ req, amount_cents });
  if (!policy.ok) return json(res, policy.status || 403, { ok: false, error: policy.reason });

  // Guardrail 2: single-use challenge nonce, bound to sku + exact price.
  const consumed = consumeChallenge({ nonce: body.nonce, sku, amount_cents });
  if (!consumed.ok) {
    releasePolicy(policy.reservation);
    return json(res, 402, { ok: false, error: consumed.reason });
  }

  // Guardrail 3: protocol settle at the exact catalog price.
  let settled;
  try {
    if (protocol === "x402") {
      const signature = body.signature || body.tx || (body.payload && body.payload.signature) || "";
      settled = await settleX402({ signature, sku, amount_cents, adapters: solanaAdapters() });
    } else if (protocol === "mpp" || protocol === "acp") {
      const credential = req.headers["payment-credential"] || body.payment_credential || body.delegated_token || "";
      settled = await settleStripeRail({ protocol, credential, sku, amount_cents, nonce: body.nonce });
    } else if (protocol === "ap2") {
      settled = settleAp2({ mandate: body.mandate, sku, amount_cents, nonce: body.nonce });
    } else {
      settled = { ok: false, reason: "unsupported_protocol" };
    }
  } catch (e) {
    releasePolicy(policy.reservation);
    return json(res, 502, { ok: false, error: "settle_failed", detail: String((e && e.message) || e) });
  }

  if (!settled.ok) {
    releasePolicy(policy.reservation);
    const status = settled.reason === "protocol_not_configured" ? 503 : settled.reason === "already_used" ? 409 : 402;
    return json(res, status, { ok: false, error: settled.reason, protocol, detail: settled.detail || null });
  }

  const receipt = gatewayReceipt({ protocol, sku, amount_cents, settled_id: settled.settled_id, nonce: body.nonce });
  return json(res, 200, {
    ok: true,
    settled: true,
    protocol,
    sku,
    amount_cents,
    receipt,
    rider: policy.rider ? { agent_id: policy.rider.agent_id || null } : null,
    warrant_reservation: policy.reservation ? policy.reservation.id : null,
  });
}
