/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Agentic Commerce Drop — sells the lab's catalog to agents on every
 * configured payment rail from one auto-routed 402.
 *
 *   GET  /api/agentic-commerce-drop           → drop manifest + rail readiness
 *   GET  /api/agentic-commerce-drop?view=config → readiness + env template
 *   POST /api/agentic-commerce-drop { sku }   → routed 402 challenge
 *   POST /api/agentic-commerce-drop { sku, nonce, ...credential }
 *        → Rider/Warrant policy → exact-price settle → receipt
 *
 * Rails and guardrails live in lib/payment-gateway.mjs; routing and
 * configuration reporting live in lib/agentic-commerce-drop.mjs.
 */
import "./lib/prod-guard.mjs";
import { paidCors } from "./lib/cors.mjs";
import { dropManifest, configTemplate, executeDropPayment } from "./lib/agentic-commerce-drop.mjs";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return {};
}

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

export default async function handler(req, res) {
  paidCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    const view = new URL(req.url || "/", "http://localhost").searchParams.get("view");
    if (view === "config") return json(res, 200, { ok: true, ...configTemplate() });
    return json(res, 200, dropManifest());
  }

  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = parseBody(req);
  if (body === null) return json(res, 400, { error: "Invalid JSON" });

  const result = await executeDropPayment({ req, body, adapters: solanaAdapters() });
  return json(res, result.status, result.body);
}
