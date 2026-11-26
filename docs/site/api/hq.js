/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * AgentHQ (/hq/[name]): $29.99/mo hosted dashboard. Creation is Stripe-gated;
 * the name becomes the owner's link `/hq/<slug>` with settings + psi control.
 *
 * Actions (query `action`, JSON body for writes):
 *   POST ?action=create    { name, email } -> { ok, url, sessionId }
 *   POST ?action=activate  { session_id }  -> { ok, slug, managementToken, url }
 *   GET  ?action=status&name=               -> { ok, exists, active }
 *   GET  ?action=settings&name= (+Bearer)   -> { ok, settings }
 *   PATCH?action=settings { name, settings } (+Bearer) -> { ok, settings }
 *
 * No database: one JSON record per HQ under AUTH_DIR/hq/<slug>.json.
 * Money moves only through Stripe Checkout; activation verifies the session
 * server-side before the record is created. Fail closed everywhere.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSlug } from "./lib/hq-slug.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HQ_PRICE_CENTS = 2999;
const HQ_INTERVAL = "month";
const HQ_LOOKUP_KEY = "spl_hq_month";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const TOKEN_RE = /^[0-9a-f]{64}$/;

function dataDir() {
  const base =
    process.env.HQ_STORE_DIR || process.env.AUTH_DIR || "/data";
  return path.join(base, "hq");
}

function recordPath(slug) {
  return path.join(dataDir(), `${slug}.json`);
}

function readRecord(slug) {
  try {
    return JSON.parse(fs.readFileSync(recordPath(slug), "utf-8"));
  } catch {
    return null;
  }
}

function writeRecord(slug, rec) {
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = path.join(dataDir(), `${slug}.json.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, recordPath(slug));
}

/** Stripe price id for AgentHQ from stripe-prices.json (test/live by env). */
export function lookupHqPriceId() {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, "lib", "stripe-prices.json"), "utf-8")
    );
    const section = process.env.STRIPE_MODE === "live" ? raw.live : raw.test;
    const entry = section && section["hq-month"];
    const id = entry && entry.price;
    if (typeof id === "string" && id.startsWith("price_")) return id;
    if (entry && entry.lookup_key === HQ_LOOKUP_KEY && id) return id;
    return null;
  } catch {
    return null;
  }
}

/** Pure builder: subscription checkout params for an HQ claim. Tested. */
export function buildHqCheckoutParams({ origin, slug, email, priceId }) {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set(
    "success_url",
    `${origin}/hq/${slug}?paid=1&session_id={CHECKOUT_SESSION_ID}`
  );
  params.set("cancel_url", `${origin}/hq/${slug}?cancel=1`);
  params.set("line_items[0][quantity]", "1");
  if (priceId) {
    params.set("line_items[0][price]", priceId);
  } else {
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(HQ_PRICE_CENTS));
    params.set("line_items[0][price_data][recurring][interval]", HQ_INTERVAL);
    params.set("line_items[0][price_data][product_data][name]", "AgentHQ");
    params.set(
      "line_items[0][price_data][product_data][description]",
      "AgentHQ hosted dashboard — $29.99/mo, cancel anytime"
    );
  }
  ["card", "link", "cashapp", "amazon_pay", "us_bank_account"].forEach((m, i) =>
    params.set(`payment_method_types[${i}]`, m)
  );
  params.set("metadata[sku]", "hq");
  params.set("metadata[slug]", slug);
  if (email) params.set("customer_email", email);
  params.set("allow_promotion_codes", "true");
  return params;
}

function stripeKey() {
  return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || "";
}

async function stripeFetch(pathname, params, method = "POST") {
  const key = stripeKey();
  if (!key) return { ok: false, reason: "no_key" };
  const url = `https://api.stripe.com/v1${pathname}${
    method === "GET" ? `?${params.toString()}` : ""
  }`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : params.toString(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, reason: data?.error?.message || `Stripe ${r.status}` };
  return { ok: true, data };
}

export async function createCheckoutSession({ origin, slug, email }) {
  const priceId = lookupHqPriceId();
  const params = buildHqCheckoutParams({ origin, slug, email, priceId });
  const r = await stripeFetch("/checkout/sessions", params);
  if (!r.ok) return r;
  return { ok: true, url: r.data.url, sessionId: r.data.id };
}

export async function retrieveCheckoutSession(sessionId) {
  if (!/^cs_[A-Za-z0-9]+$/.test(String(sessionId || ""))) {
    return { ok: false, reason: "bad_session_id" };
  }
  const r = await stripeFetch(`/checkout/sessions/${sessionId}`, new URLSearchParams(), "GET");
  if (!r.ok) return r;
  const paid = r.data.payment_status === "paid";
  return {
    ok: paid,
    reason: paid ? undefined : "not_paid",
    metadata: r.data.metadata || {},
    email: r.data.customer_email || "",
  };
}

/** Validate a settings patch. Unknown keys rejected. */
export function validateSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "bad_settings" };
  }
  const allowed = [
    "displayName",
    "alertEmail",
    "dailyCapCents",
    "webhookUrl",
    "psiEnabled",
  ];
  for (const k of Object.keys(input)) {
    if (!allowed.includes(k)) return { ok: false, reason: "unknown_key" };
  }
  const out = {};
  if (input.displayName !== undefined) {
    const v = String(input.displayName).slice(0, 60);
    if (!v.trim()) return { ok: false, reason: "bad_display_name" };
    out.displayName = v;
  }
  if (input.alertEmail !== undefined) {
    const v = String(input.alertEmail).trim();
    if (v && !EMAIL_RE.test(v)) return { ok: false, reason: "bad_email" };
    out.alertEmail = v;
  }
  if (input.dailyCapCents !== undefined) {
    const v = Number(input.dailyCapCents);
    if (!Number.isInteger(v) || v < 0 || v > 1000000) {
      return { ok: false, reason: "bad_cap" };
    }
    out.dailyCapCents = v;
  }
  if (input.webhookUrl !== undefined) {
    const v = String(input.webhookUrl).trim();
    if (v && !/^https:\/\/\S+$/.test(v)) return { ok: false, reason: "bad_url" };
    out.webhookUrl = v;
  }
  if (input.psiEnabled !== undefined) {
    if (typeof input.psiEnabled !== "boolean") {
      return { ok: false, reason: "bad_psi" };
    }
    out.psiEnabled = input.psiEnabled;
  }
  return { ok: true, settings: out };
}

function bearerToken(req) {
  const h = (req && req.headers) || {};
  const auth = String(h.authorization || h.Authorization || "");
  const m = /^Bearer\s+([0-9a-f]{64})\s*$/i.exec(auth);
  return m ? m[1].toLowerCase() : "";
}

function checkOwner(req, rec) {
  const tok = bearerToken(req);
  if (!tok || !TOKEN_RE.test(String(rec.managementToken || ""))) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(rec.managementToken));
  } catch {
    return false;
  }
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function originOf(req) {
  const proto = req.headers?.["x-forwarded-proto"] || "https";
  const host = req.headers?.host || "www.slidphilabs.com";
  return `${proto}://${host}`;
}

function readInput(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return { __badJson: true };
    }
  }
  if (!body || typeof body !== "object") body = {};
  return { ...(req.query || {}), ...body };
}

export default async function hqHandler(req, res) {
  const input = readInput(req);
  if (input.__badJson) return send(res, 400, { ok: false, reason: "bad_json" });
  const action = String(input.action || "").toLowerCase();
  const body = input;
  const q = { get: (k) => input[k] };
  if (req.method === "POST" && action === "create") {
    const v = validateSlug(body && body.name);
    if (!v.ok) return send(res, 400, { ok: false, reason: "bad_name", detail: v.reason });
    const email = String((body && body.email) || "").trim();
    if (!EMAIL_RE.test(email)) return send(res, 400, { ok: false, reason: "bad_email" });
    if (readRecord(v.slug)) return send(res, 409, { ok: false, reason: "name_taken" });
    const origin = originOf(req);
    const r = await createCheckoutSession({ origin, slug: v.slug, email });
    if (!r.ok) {
      const code = r.reason === "no_key" ? 503 : 502;
      return send(res, code, { ok: false, reason: r.reason || "checkout_failed" });
    }
    return send(res, 200, { ok: true, url: r.url, sessionId: r.sessionId });
  }
  if (req.method === "POST" && action === "activate") {
    const sessionId = String((body && body.session_id) || "");
    const r = await retrieveCheckoutSession(sessionId);
    if (!r.ok) return send(res, 402, { ok: false, reason: r.reason || "not_paid" });
    const slugRaw = String((r.metadata && r.metadata.slug) || "");
    const v = validateSlug(slugRaw);
    if (!v.ok || String(r.metadata.sku || "").toLowerCase() !== "hq") {
      return send(res, 402, { ok: false, reason: "wrong_product" });
    }
    if (readRecord(v.slug)) return send(res, 409, { ok: false, reason: "name_taken" });
    const now = new Date().toISOString();
    const rec = {
      slug: v.slug,
      email: r.email || String(r.metadata.email || ""),
      status: "active",
      managementToken: crypto.randomBytes(32).toString("hex"),
      settings: {
        displayName: v.slug,
        alertEmail: "",
        dailyCapCents: 0,
        webhookUrl: "",
        psiEnabled: false,
      },
      stripeSession: sessionId,
      created: now,
      updated: now,
    };
    writeRecord(v.slug, rec);
    return send(res, 200, {
      ok: true,
      slug: v.slug,
      url: `/hq/${v.slug}`,
      managementToken: rec.managementToken,
    });
  }
  if (req.method === "GET" && action === "status") {
    const v = validateSlug(q.get("name"));
    if (!v.ok) return send(res, 400, { ok: false, reason: "bad_name" });
    const rec = readRecord(v.slug);
    if (!rec) return send(res, 404, { ok: false, reason: "unknown_hq" });
    return send(res, 200, { ok: true, exists: true, active: rec.status === "active" });
  }
  if (req.method === "GET" && action === "settings") {
    const v = validateSlug(q.get("name"));
    if (!v.ok) return send(res, 400, { ok: false, reason: "bad_name" });
    const rec = readRecord(v.slug);
    if (!rec) return send(res, 404, { ok: false, reason: "unknown_hq" });
    if (!checkOwner(req, rec)) return send(res, 401, { ok: false, reason: "unauthorized" });
    return send(res, 200, { ok: true, settings: rec.settings });
  }
  if ((req.method === "PATCH" || req.method === "POST") && action === "settings") {
    const v = validateSlug((body && body.name) || q.get("name"));
    if (!v.ok) return send(res, 400, { ok: false, reason: "bad_name" });
    const rec = readRecord(v.slug);
    if (!rec) return send(res, 404, { ok: false, reason: "unknown_hq" });
    if (!checkOwner(req, rec)) return send(res, 401, { ok: false, reason: "unauthorized" });
    const sv = validateSettings(body && body.settings);
    if (!sv.ok) return send(res, 400, { ok: false, reason: sv.reason });
    rec.settings = { ...rec.settings, ...sv.settings };
    rec.updated = new Date().toISOString();
    writeRecord(v.slug, rec);
    return send(res, 200, { ok: true, settings: rec.settings });
  }
  return send(res, 404, { ok: false, reason: "unknown_action" });
}
