#!/usr/bin/env node
/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Stripe subscriptions setup + end-to-end proof for the Slid Phi Labs, Inc. account.
 *
 *   STRIPE_SETUP_KEY=sk_test_… node docs/site/scripts/stripe-subscriptions-setup.mjs           # test mode: setup + test-clock proof
 *   STRIPE_SETUP_KEY=sk_live_… node docs/site/scripts/stripe-subscriptions-setup.mjs --live    # live: setup only, no charges
 *
 * Idempotent. Creates (or finds) one Product per plan (fixed ids spl_*), one
 * recurring Price per SKU (lookup_key spl_<sku>, amounts from payments-rails.js),
 * a customer portal configuration, and the subscription webhook events.
 * Writes the price ids into api/lib/stripe-prices.json under test|live.
 *
 * Test mode then proves every plan with a Stripe test clock: subscribe with the
 * test card, advance past month 2 (or year 2), check the renewal invoice is paid,
 * cancel, then replays the real Stripe events through the webhook's own reducer
 * (lib/stripe-subscriptions.mjs) to show access granted, extended and revoked.
 * Never prints secrets. Live mode never creates a customer, subscription or charge.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PRODUCT_CATALOG, SUBSCRIPTION_SKUS } from "../api/lib/payments-rails.js";
import { applyStripeEvent, blankBook, hasAccess } from "../api/lib/stripe-subscriptions.mjs";

const LIVE = process.argv.includes("--live");
const KEY = (process.env.STRIPE_SETUP_KEY || "").trim();
const isTest = /^(sk|rk)_test_/.test(KEY);
if (!KEY) die("Set STRIPE_SETUP_KEY.");
if (LIVE === isTest) die(LIVE ? "--live needs a live key." : "Test run needs a test key (sk_test_/rk_test_). Use --live for live.");
const MODE = LIVE ? "live" : "test";
const SITE = process.env.SITE_ORIGIN || "https://www.slidphilabs.com";
const WEBHOOK_URL = `${SITE}/api/stripe-webhook`;
const EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];
const FAMILY = {
  "chamber-month": ["spl_chamber", "Chamber"], "chamber-year": ["spl_chamber", "Chamber"],
  "rider-solo": ["spl_rider_solo", "Rider Solo"], "rider-solo-year": ["spl_rider_solo", "Rider Solo"],
  "pcc-pro": ["spl_pcc_pro", "PCC Pro"], "pcc-pro-year": ["spl_pcc_pro", "PCC Pro"],
  "psi-meter": ["spl_psi_meter", "PSI Meter"], "psi-meter-year": ["spl_psi_meter", "PSI Meter"],
  "psi-org": ["spl_psi_org", "PSI Org"],
  "warrant-addon": ["spl_warrant_addon", "Warrant add-on"], "warrant-addon-year": ["spl_warrant_addon", "Warrant add-on"],
};

function die(m) { console.error(m); process.exit(2); }
const log = (...a) => console.log(...a);

function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function api(method, path, body) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? form(body).toString() : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`${method} ${path}: ${d?.error?.message || r.status}`); e.status = r.status; throw e; }
  return d;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureProduct(id, name) {
  try { return await api("GET", `/products/${id}`); } catch (e) { if (e.status !== 404) throw e; }
  return api("POST", "/products", { id, name: `Slid Phi Labs · ${name}`, metadata: { spl_family: id } });
}

async function ensurePrice(sku) {
  const p = PRODUCT_CATALOG[sku];
  const lookup = p.lookup_key;
  const found = await api("GET", `/prices?active=true&lookup_keys[0]=${encodeURIComponent(lookup)}`);
  const hit = found.data && found.data[0];
  if (hit && hit.unit_amount === p.amount_cents && hit.recurring?.interval === p.recurring && hit.currency === "usd") return hit;
  const [prodId, fam] = FAMILY[sku];
  await ensureProduct(prodId, fam);
  return api("POST", "/prices", {
    product: prodId, currency: "usd", unit_amount: p.amount_cents,
    recurring: { interval: p.recurring }, lookup_key: lookup, transfer_lookup_key: hit ? "true" : undefined,
    nickname: `${fam} · ${p.recurring}ly`, metadata: { sku },
  });
}

async function ensurePortal(prices) {
  const products = {};
  for (const [sku, price] of Object.entries(prices)) {
    const pid = FAMILY[sku][0];
    (products[pid] = products[pid] || []).push(price);
  }
  const body = {
    business_profile: { headline: "Slid Phi Labs: manage or cancel your plan", privacy_policy_url: `${SITE}/privacy`, terms_of_service_url: `${SITE}/terms` },
    default_return_url: `${SITE}/access`,
    features: {
      customer_update: { enabled: "true", allowed_updates: ["email", "address"] },
      invoice_history: { enabled: "true" },
      payment_method_update: { enabled: "true" },
      subscription_cancel: { enabled: "true", mode: "at_period_end", proration_behavior: "none" },
    },
    metadata: { spl: "subscriptions-v1" },
  };
  const list = await api("GET", "/billing_portal/configurations?limit=20&active=true");
  const mine = (list.data || []).find((c) => c.metadata && c.metadata.spl === "subscriptions-v1");
  return mine ? api("POST", `/billing_portal/configurations/${mine.id}`, body) : api("POST", "/billing_portal/configurations", body);
}

async function ensureWebhook() {
  const list = await api("GET", "/webhook_endpoints?limit=50");
  const urls = [WEBHOOK_URL, WEBHOOK_URL.replace("www.slidphilabs.com", "spl-slidphilabs.fly.dev")];
  const mine = (list.data || []).find((w) => urls.includes(w.url));
  if (mine) {
    const events = [...new Set([...(mine.enabled_events || []), ...EVENTS])];
    const upd = await api("POST", `/webhook_endpoints/${mine.id}`, { enabled_events: events });
    return { id: upd.id, url: upd.url, created: false, events: upd.enabled_events };
  }
  const w = await api("POST", "/webhook_endpoints", { url: WEBHOOK_URL, enabled_events: EVENTS, description: "Lab seats + subscriptions (Inc)" });
  // The signing secret is shown once by Stripe. Write it to a 0600 file, never to stdout.
  const f = `/tmp/spl-whsec-${MODE}-${w.id}`;
  writeFileSync(f, w.secret || "", { mode: 0o600 });
  return { id: w.id, url: w.url, created: true, events: w.enabled_events, secret_file: f };
}

function savePriceIds(prices) {
  const url = new URL("../api/lib/stripe-prices.json", import.meta.url);
  const path = fileURLToPath(url);
  const book = JSON.parse(readFileSync(path, "utf8"));
  book[MODE] = Object.fromEntries(Object.entries(prices).map(([sku, id]) => [sku, { price: id, lookup_key: PRODUCT_CATALOG[sku].lookup_key, product: FAMILY[sku][0] }]));
  writeFileSync(path, JSON.stringify(book, null, 2) + "\n");
  return path;
}

async function waitClock(id) {
  for (let i = 0; i < 90; i++) {
    const c = await api("GET", `/test_helpers/test_clocks/${id}`);
    if (c.status === "ready") return c;
    if (c.status === "internal_failure") throw new Error("test clock failed");
    await sleep(2000);
  }
  throw new Error("test clock timeout");
}

async function eventsFor(subId, customer) {
  const out = [];
  for (const type of EVENTS) {
    const page = await api("GET", `/events?type=${type}&limit=100`);
    for (const e of page.data || []) {
      const o = e.data.object;
      const sid = o.object === "subscription" ? o.id : typeof o.subscription === "string" ? o.subscription : o.parent?.subscription_details?.subscription;
      if (sid === subId || (o.customer === customer && o.object === "checkout.session")) out.push(e);
    }
  }
  return out.sort((a, b) => a.created - b.created);
}

async function proveSku(sku, priceId, portalId) {
  const iv = PRODUCT_CATALOG[sku].recurring;
  const t0 = Math.floor(Date.now() / 1000);
  const clock = await api("POST", "/test_helpers/test_clocks", { frozen_time: t0, name: `spl ${sku}` });
  try {
    const cus = await api("POST", "/customers", { test_clock: clock.id, payment_method: "pm_card_visa", invoice_settings: { default_payment_method: "pm_card_visa" }, metadata: { spl_test: sku } });
    const sub = await api("POST", "/subscriptions", { customer: cus.id, items: [{ price: priceId }], metadata: { sku, source: "spl_universal_checkout" }, expand: ["latest_invoice"] });
    const portal = await api("POST", "/billing_portal/sessions", { customer: cus.id, configuration: portalId, return_url: `${SITE}/access` });
    const step = iv === "year" ? 366 * 86400 + 3600 : 31 * 86400 + 3600;
    await api("POST", `/test_helpers/test_clocks/${clock.id}/advance`, { frozen_time: t0 + step });
    const c2 = await waitClock(clock.id);
    const invs = await api("GET", `/invoices?subscription=${sub.id}&limit=10`);
    const paid = (invs.data || []).filter((i) => i.status === "paid");
    const renewal = paid.find((i) => i.billing_reason === "subscription_cycle");
    await api("DELETE", `/subscriptions/${sub.id}`);
    const after = await api("GET", `/subscriptions/${sub.id}`);
    await sleep(3000);
    const events = await eventsFor(sub.id, cus.id);
    const book = blankBook();
    let renewedUntil = 0;
    let accessAfterRenewal = false;
    for (const e of events) {
      const now = e.type === "customer.subscription.deleted" ? c2.frozen_time : e.created;
      const r = applyStripeEvent(book, e, { nowSec: now, intervalFor: () => iv });
      if (r.action === "renewed") { renewedUntil = book.subs[sub.id].access_until; accessAfterRenewal = hasAccess(book.subs[sub.id], c2.frozen_time); }
    }
    const rec = book.subs[sub.id];
    const revoked = rec && !hasAccess(rec, c2.frozen_time + 1);
    const ok = !!(renewal && renewal.amount_paid === PRODUCT_CATALOG[sku].amount_cents && accessAfterRenewal && renewedUntil > c2.frozen_time && after.status === "canceled" && revoked && /^https:\/\/billing\.stripe\.com\//.test(portal.url));
    return {
      sku, ok, clock: clock.id, subscription: sub.id, customer: cus.id,
      first_invoice: sub.latest_invoice?.id, first_invoice_status: sub.latest_invoice?.status,
      renewal_invoice: renewal?.id || null, renewal_paid_cents: renewal?.amount_paid ?? null,
      access_after_renewal: accessAfterRenewal, access_until: renewedUntil ? new Date(renewedUntil * 1000).toISOString() : null,
      cancel_status: after.status, access_revoked: revoked, portal_session: !!portal.url, events: events.map((e) => e.type),
    };
  } finally {
    await api("DELETE", `/test_helpers/test_clocks/${clock.id}`).catch(() => {});
  }
}

async function main() {
  log(`mode: ${MODE}`);
  const prices = {};
  for (const sku of SUBSCRIPTION_SKUS()) {
    const pr = await ensurePrice(sku);
    prices[sku] = pr.id;
    log(`price ${sku}: ${pr.id} (${pr.unit_amount} usd/${pr.recurring.interval}, product ${pr.product})`);
  }
  const portal = await ensurePortal(prices);
  log(`portal config: ${portal.id}`);
  const wh = await ensureWebhook();
  log(`webhook: ${wh.id} ${wh.url} created=${wh.created} events=${wh.events.join(",")}${wh.secret_file ? " secret_file=" + wh.secret_file : ""}`);
  log(`price ids saved: ${savePriceIds(prices)}`);
  // A Checkout Session in subscription mode, created and left unpaid (expires on its own).
  const cs = await api("POST", "/checkout/sessions", {
    mode: "subscription", line_items: [{ price: prices["chamber-month"], quantity: 1 }],
    success_url: `${SITE}/access?paid=1&product=chamber-month&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${SITE}/pay?cancel=1`,
    subscription_data: { metadata: { sku: "chamber-month", source: "spl_setup_check" } }, metadata: { sku: "chamber-month" },
  });
  log(`checkout session (unpaid): ${cs.id} mode=${cs.mode} amount_total=${cs.amount_total}`);
  if (LIVE) return;
  const results = [];
  for (const sku of SUBSCRIPTION_SKUS()) {
    const r = await proveSku(sku, prices[sku], portal.id);
    results.push(r);
    log(JSON.stringify(r));
  }
  writeFileSync(`/tmp/spl-testclock-proof.json`, JSON.stringify(results, null, 2));
  const bad = results.filter((r) => !r.ok);
  log(bad.length ? `FAIL: ${bad.map((b) => b.sku).join(", ")}` : `PASS: ${results.length} plans subscribed, renewed, cancelled`);
  if (bad.length) process.exit(1);
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
