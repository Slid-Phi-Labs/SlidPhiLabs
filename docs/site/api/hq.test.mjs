/**
 * AgentHQ tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial.
 *
 * Covers slug validation, checkout-param building, settings validation, and
 * the /api/hq handler with mock req/res (no network, no disk writes outside
 * a temp AUTH_DIR): create validation, unknown-HQ 404s, auth gating.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateSlug, normalizeSlug } from "./lib/hq-slug.mjs";
import hqHandler, {
  buildHqCheckoutParams,
  validateSettings,
} from "./hq.js";

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[String(k).toLowerCase()] = v;
    },
    end(body) {
      this.body = typeof body === "string" ? body : JSON.stringify(body);
      try {
        this.json = JSON.parse(this.body);
      } catch {
        this.json = null;
      }
    },
  };
}

function mockReq({ method = "GET", query = {}, body = undefined, headers = {} } = {}) {
  return { method, query, body, headers, url: "/api/hq" };
}

test("slug rules accept good names and reject the rest", () => {
  assert.equal(validateSlug("my-hq").slug, "my-hq");
  assert.equal(validateSlug("/My-HQ/").slug, "my-hq");
  for (const bad of ["", "ab", "x".repeat(31), "UPPER ok", "has space", "-lead", "trail-", "admin", "api", "hq"]) {
    assert.equal(validateSlug(bad).ok, false, bad);
  }
  assert.equal(normalizeSlug("  /Foo/ "), "foo");
});

test("checkout params are a $29.99/mo subscription with slug metadata", () => {
  const p = buildHqCheckoutParams({
    origin: "https://www.slidphilabs.com",
    slug: "acme",
    email: "a@example.com",
    priceId: null,
  });
  assert.equal(p.get("mode"), "subscription");
  assert.equal(p.get("line_items[0][price_data][unit_amount]"), "2999");
  assert.equal(p.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(p.get("metadata[sku]"), "hq");
  assert.equal(p.get("metadata[slug]"), "acme");
  assert.match(p.get("success_url"), /\/hq\/acme\?paid=1/);
  const withPrice = buildHqCheckoutParams({
    origin: "https://www.slidphilabs.com",
    slug: "acme",
    email: "",
    priceId: "price_123",
  });
  assert.equal(withPrice.get("line_items[0][price]"), "price_123");
  assert.equal(withPrice.get("line_items[0][price_data][unit_amount]"), null);
});

test("settings validation accepts known keys and rejects the rest", () => {
  const good = validateSettings({ displayName: "Acme", alertEmail: "", dailyCapCents: 500, webhookUrl: "" });
  assert.equal(good.ok, true);
  assert.equal(validateSettings({ evil: 1 }).ok, false);
  assert.equal(validateSettings({ dailyCapCents: -5 }).ok, false);
  assert.equal(validateSettings({ alertEmail: "not-an-email" }).ok, false);
  assert.equal(validateSettings({ webhookUrl: "http://x" }).ok, false);
  assert.equal(validateSettings("nope").ok, false);
});

test("handler rejects bad names, unknown HQs, and unauthenticated writes", async () => {
  process.env.HQ_STORE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hq-test-"));
  let res = mockRes();
  await hqHandler(mockReq({ method: "POST", body: { action: "create", name: "!!", email: "a@b.co" } }), res);
  assert.equal(res.statusCode, 400);

  res = mockRes();
  await hqHandler(mockReq({ method: "GET", query: { action: "status", name: "nope-no-hq" } }), res);
  assert.equal(res.statusCode, 404);

  res = mockRes();
  await hqHandler(
    mockReq({ method: "PATCH", body: { action: "settings", name: "nope-no-hq", settings: { displayName: "x" } } }),
    res
  );
  assert.equal(res.statusCode, 404);

  res = mockRes();
  await hqHandler(
    mockReq({ method: "POST", body: { action: "create", name: "good-name", email: "bad" } }),
    res
  );
  assert.equal(res.statusCode, 400);
});

test("create with valid input but no Stripe key fails closed, no charge", async () => {
  const savedSecret = process.env.STRIPE_SECRET_KEY;
  const savedRestricted = process.env.STRIPE_RESTRICTED_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_RESTRICTED_KEY;
  try {
    const res = mockRes();
    await hqHandler(
      mockReq({ method: "POST", body: { action: "create", name: "good-name", email: "buyer@example.com" } }),
      res
    );
    assert.equal(res.statusCode, 503);
    assert.equal(res.json && res.json.reason, "no_key");
  } finally {
    if (savedSecret !== undefined) process.env.STRIPE_SECRET_KEY = savedSecret;
    if (savedRestricted !== undefined) process.env.STRIPE_RESTRICTED_KEY = savedRestricted;
  }
});
