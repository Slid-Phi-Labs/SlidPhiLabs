/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * GET|POST /api/billing-portal?session_id=cs_…  — "Manage or cancel".
 *
 * Opens the Stripe customer portal for the customer behind a subscription
 * Checkout Session. The cs_ id is what the buyer gets back on the success
 * page, so only the buyer can open their own portal. GET redirects (303)
 * straight to Stripe; POST answers { url }.
 *
 * Env: STRIPE_SECRET_KEY | STRIPE_RESTRICTED_KEY (needs Checkout Sessions
 * read + Customer portal write), optional STRIPE_PORTAL_CONFIG (bpc_…) per
 * mode, PUBLIC_SITE_ORIGIN.
 */
import { stripeSecret, siteOrigin } from "./lib/payments-rails.js";
import { logInternal } from "./lib/http-fail.mjs";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function sessionIdFrom(req) {
  let b = req.body;
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  if (Buffer.isBuffer(b)) {
    try { b = JSON.parse(b.toString("utf8")); } catch { b = {}; }
  }
  const q = req.query || {};
  return String((b && (b.session_id || b.session)) || q.session_id || q.session || "").trim();
}

export async function openPortal({ sessionId, origin, key, fetchImpl = fetch, configuration = "" }) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return { status: 400, body: { ok: false, error: "missing_or_invalid_session" } };
  if (!key) return { status: 503, body: { ok: false, error: "stripe_not_configured" } };
  const auth = { Authorization: `Bearer ${key}` };
  const r = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: auth });
  const s = await r.json().catch(() => ({}));
  if (!r.ok) return { status: r.status === 404 ? 404 : 502, body: { ok: false, error: "session_not_found" } };
  const customer = typeof s.customer === "string" ? s.customer : s.customer && s.customer.id;
  if (s.mode !== "subscription" || !customer) {
    return { status: 409, body: { ok: false, error: "not_a_subscription", message: "This purchase does not renew, so there is nothing to cancel." } };
  }
  const params = new URLSearchParams();
  params.set("customer", customer);
  params.set("return_url", `${origin}/access?session_id=${encodeURIComponent(sessionId)}`);
  if (/^bpc_[A-Za-z0-9]+$/.test(configuration)) params.set("configuration", configuration);
  const p = await fetchImpl("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const ps = await p.json().catch(() => ({}));
  if (!p.ok || !ps.url) return { status: 502, body: { ok: false, error: "portal_failed" } };
  return { status: 200, body: { ok: true, url: ps.url } };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });
  try {
    const out = await openPortal({
      sessionId: sessionIdFrom(req),
      origin: siteOrigin(req),
      key: stripeSecret(),
      configuration: String(process.env.STRIPE_PORTAL_CONFIG || "").trim(),
    });
    if (req.method === "GET" && out.status === 200) {
      res.statusCode = 303;
      res.setHeader("Location", out.body.url);
      res.setHeader("Cache-Control", "no-store");
      return res.end();
    }
    return json(res, out.status, out.body);
  } catch (e) {
    return json(res, 502, { ok: false, error: "portal_failed", request_id: logInternal(req, "billing-portal", e) });
  }
}
