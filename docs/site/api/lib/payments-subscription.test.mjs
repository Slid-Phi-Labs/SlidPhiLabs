import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_CATALOG, subscriptionPriceId, stripeKeyMode, createStripeCheckoutSession, SUBSCRIPTION_SKUS, resolveSku,
} from "./payments-rails.js";

test("plans that renew carry an interval and a stable lookup key; prices unchanged", () => {
  const want = {
    "chamber-month": ["month", 2000], "chamber-year": ["year", 20000],
    "rider-solo": ["month", 1200], "rider-solo-year": ["year", 12000],
    "pcc-pro": ["month", 2500], "pcc-pro-year": ["year", 25000],
    "psi-meter": ["month", 2500], "psi-meter-year": ["year", 25000], "psi-org": ["month", 7900],
    "warrant-addon": ["month", 800], "warrant-addon-year": ["year", 8000],
  };
  assert.deepEqual(SUBSCRIPTION_SKUS().sort(), Object.keys(want).sort());
  for (const [sku, [iv, cents]] of Object.entries(want)) {
    assert.equal(PRODUCT_CATALOG[sku].recurring, iv, sku);
    assert.equal(PRODUCT_CATALOG[sku].amount_cents, cents, sku);
    assert.equal(PRODUCT_CATALOG[sku].lookup_key, "spl_" + sku.replace(/-/g, "_"));
  }
  assert.equal(PRODUCT_CATALOG["lab-pass"].recurring, undefined);
});

test("PSI Org buy link points at a real SKU", () => {
  const u = new URL(PRODUCT_CATALOG["psi-org"].stripe);
  assert.equal(resolveSku(u.searchParams.get("sku")), "psi-org");
});

test("price id: env wins, bad values ignored, one-time SKUs never get one", () => {
  process.env.STRIPE_PRICE_CHAMBER_MONTH = "price_ABC123";
  assert.equal(subscriptionPriceId("chamber-month"), "price_ABC123");
  process.env.STRIPE_PRICE_CHAMBER_MONTH = "garbage";
  assert.equal(subscriptionPriceId("chamber-month", "nomode"), null);
  delete process.env.STRIPE_PRICE_CHAMBER_MONTH;
  process.env.STRIPE_PRICE_LAB_PASS = "price_X";
  assert.equal(subscriptionPriceId("lab-pass"), null);
  delete process.env.STRIPE_PRICE_LAB_PASS;
  assert.equal(stripeKeyMode("sk_test_x"), "test");
  assert.equal(stripeKeyMode("rk_test_x"), "test");
  assert.equal(stripeKeyMode("rk_live_x"), "live");
});

test("checkout: subscription mode with saved price, payment mode without", async () => {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push(new URLSearchParams(init.body)); return { ok: true, status: 200, json: async () => ({ id: "cs_test_1", url: "https://checkout.stripe.com/x" }) }; };
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  try {
    await createStripeCheckoutSession({ priceId: "price_ABC", sku: "chamber-month", origin: "https://x", name: "n" });
    await createStripeCheckoutSession({ amountCents: 49500, sku: "lab-pass", origin: "https://x", name: "Lab Pass" });
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.STRIPE_SECRET_KEY;
  }
  assert.equal(sent[0].get("mode"), "subscription");
  assert.equal(sent[0].get("line_items[0][price]"), "price_ABC");
  assert.equal(sent[0].get("subscription_data[metadata][sku]"), "chamber-month");
  assert.equal(sent[0].get("submit_type"), null);
  assert.equal(sent[0].get("line_items[0][price_data][unit_amount]"), null);
  assert.equal(sent[1].get("mode"), "payment");
  assert.equal(sent[1].get("line_items[0][price_data][unit_amount]"), "49500");
});

test("saved price book: test ids resolve for every recurring sku; live empty except AgentHQ hq-month", async () => {
  const m = await import("./payments-rails.js");
  const book = m.stripePriceBook();
  // AgentHQ is the first live recurring Price; other catalog SKUs stay empty (one-time fallback).
  assert.deepEqual(Object.keys(book.live || {}).sort(), ["hq-month"]);
  assert.match(book.live["hq-month"].price || "", /^price_[A-Za-z0-9]+$/);
  assert.equal(book.live["hq-month"].lookup_key, "spl_hq_month");
  assert.equal(book.live["hq-month"].amount, 2999);
  for (const sku of m.SUBSCRIPTION_SKUS()) {
    const envKey = "STRIPE_PRICE_" + sku.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    if (process.env[envKey]) continue;
    assert.match(m.subscriptionPriceId(sku, "test") || "", /^price_[A-Za-z0-9]+$/, sku);
    assert.equal(book.test[sku].lookup_key, m.PRODUCT_CATALOG[sku].lookup_key, sku);
    assert.equal(m.subscriptionPriceId(sku, "live"), null, sku);
  }
});
