/**
 * AgentHQ tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial.
 *
 * Covers slug validation, checkout-param building, settings validation, and
 * the /api/hq handler with mock req/res (no network, no disk writes outside
 * a temp AUTH_DIR): create validation, unknown-HQ 404s, auth gating,
 * session-reuse, status slug echo, owner settings round-trip.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateSlug, normalizeSlug } from "./lib/hq-slug.mjs";
import hqHandler, {
  buildHqCheckoutParams,
  lookupHqPriceId,
  sessionAlreadyUsed,
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

function seedHq(storeDir, { slug, token, stripeSession = "cs_test_seed1" } = {}) {
  const dir = path.join(storeDir, "hq");
  fs.mkdirSync(dir, { recursive: true });
  const managementToken = token || crypto.randomBytes(32).toString("hex");
  const rec = {
    slug,
    email: "owner@example.com",
    status: "active",
    managementToken,
    settings: {
      displayName: slug,
      alertEmail: "",
      dailyCapCents: 0,
      webhookUrl: "",
      psiEnabled: false,
    },
    stripeSession,
    created: "2026-11-26T00:00:00.000Z",
    updated: "2026-11-26T00:00:00.000Z",
  };
  fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(rec, null, 2) + "\n");
  return rec;
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

test("lookupHqPriceId returns the wired AgentHQ Price id", () => {
  const id = lookupHqPriceId();
  assert.equal(id, "price_1UfxcLLehTFD59CGBhLOr1Cl");
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

test("activate rejects bad session ids without Stripe; reused sessions 409", async () => {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), "hq-act-"));
  process.env.HQ_STORE_DIR = store;
  seedHq(store, { slug: "seeded-hq", stripeSession: "cs_test_already" });

  let res = mockRes();
  await hqHandler(mockReq({ method: "POST", body: { action: "activate", session_id: "not-a-session" } }), res);
  assert.equal(res.statusCode, 402);
  assert.equal(res.json && res.json.reason, "bad_session_id");

  res = mockRes();
  await hqHandler(
    mockReq({ method: "POST", body: { action: "activate", session_id: "cs_test_already" } }),
    res
  );
  assert.equal(res.statusCode, 409);
  assert.equal(res.json && res.json.reason, "session_used");
  assert.equal(sessionAlreadyUsed("cs_test_already"), true);
  assert.equal(sessionAlreadyUsed("cs_test_fresh"), false);
});

test("status + settings owner path on seeded HQ", async () => {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), "hq-own-"));
  process.env.HQ_STORE_DIR = store;
  const rec = seedHq(store, { slug: "acme-lab" });

  let res = mockRes();
  await hqHandler(mockReq({ method: "GET", query: { action: "status", name: "acme-lab" } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.slug, "acme-lab");
  assert.equal(res.json.exists, true);
  assert.equal(res.json.active, true);

  res = mockRes();
  await hqHandler(mockReq({ method: "GET", query: { action: "settings", name: "acme-lab" } }), res);
  assert.equal(res.statusCode, 401);

  res = mockRes();
  await hqHandler(
    mockReq({
      method: "GET",
      query: { action: "settings", name: "acme-lab" },
      headers: { authorization: `Bearer ${rec.managementToken}` },
    }),
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.settings.displayName, "acme-lab");

  res = mockRes();
  await hqHandler(
    mockReq({
      method: "PATCH",
      body: { action: "settings", name: "acme-lab", settings: { displayName: "Acme Lab", psiEnabled: true } },
      headers: { authorization: `Bearer ${rec.managementToken}` },
    }),
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.settings.displayName, "Acme Lab");
  assert.equal(res.json.settings.psiEnabled, true);

  res = mockRes();
  await hqHandler(
    mockReq({
      method: "POST",
      body: { action: "create", name: "acme-lab", email: "buyer@example.com" },
    }),
    res
  );
  assert.equal(res.statusCode, 409);
  assert.equal(res.json.reason, "name_taken");
});
