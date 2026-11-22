/**
 * Regression tests for the 2026-11-22 security fixes (C1, C2, H3, H4).
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.AUTH_DIR = mkdtempSync(join(tmpdir(), "secfix-"));
process.env.X402_CLAIM_SECRET = "test-claim-secret-0123456789abcdef";
process.env.X402_PAY_TO = "";
process.env.X402_PAY_TO_BASE = "0x000000000000000000000000000000000000dEaD";
process.env.X402_DEV_BYPASS = "";
process.env.SPL_OWNER_TOKEN = "owner-token-for-tests-0123456789abcdef";
process.env.SPL_OWNER_EMAILS = "owner@example.com";
delete process.env.NOTION_TOKEN;

const { signClaim, verifyClaim } = await import("./lib/x402-claim.mjs");
const { isOwnerRequest, resolveOwnerLane } = await import("./lib/owner-gratis.mjs");
const { ownerFromReq, cleanIp } = await import("./lib/usage-meter.mjs");
const products = await import("./x402-products.js");
const verify = await import("./access-verify.js");

function mockRes() {
  let body = "";
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = String(v); },
    getHeader(k) { return this.headers[k.toLowerCase()]; },
    status(c) { this.statusCode = c; return this; },
    json(o) { body = JSON.stringify(o); },
    end(d) { if (d !== undefined) body += String(d); },
  };
  return { res, json: () => JSON.parse(body || "{}") };
}

const post = (body, headers = {}) => ({ method: "POST", headers, query: {}, url: "/api/x402-products", body });

// ---- C1: typed owner email no longer skips payment ----
test("C1: owner email in body without payment gets 402, not a claim", async () => {
  const m = mockRes();
  await products.default(post({ sku: "lab-pass", email: "owner@example.com" }), m.res);
  assert.equal(m.res.statusCode, 402);
  assert.equal(m.json().claim_token, undefined);
});

test("C1: owner token header mints an owner-flagged claim", async () => {
  const m = mockRes();
  await products.default(post({ sku: "chamber-month" }, { "x-spl-owner-token": process.env.SPL_OWNER_TOKEN }), m.res);
  assert.equal(m.res.statusCode, 200, JSON.stringify(m.json()).slice(0, 300));
  const v = verifyClaim(m.json().claim_token);
  assert.equal(v.ok, true);
  assert.equal(v.payload.owner, true);
});

test("C1: wrong or short owner token is refused", () => {
  assert.equal(isOwnerRequest({ headers: { "x-spl-owner-token": "nope" } }), false);
  assert.equal(isOwnerRequest({ headers: {} }), false);
  assert.equal(
    isOwnerRequest({ headers: { "x-spl-owner-token": "short" } }, { SPL_OWNER_TOKEN: "short" }),
    false,
    "tokens under 32 chars disable the lane"
  );
});

test("C1: email inside a signed claim no longer grants owner gratis", () => {
  const s = signClaim({ order_id: "o1", sku: "lab-check", email: "owner@example.com", tx: "0xabc", network: "base", amount_cents: 5 });
  assert.equal(ownerFromReq({ headers: { authorization: "Bearer " + s.token } }), false);
  const o = signClaim({ order_id: "o2", sku: "pcc-pro", tx: "owner-gratis", network: "owner", amount_cents: 0, owner: true });
  assert.equal(ownerFromReq({ headers: { authorization: "Bearer " + o.token } }), true);
});

test("C1: claims minted by the retired email lane are revoked", () => {
  const old = signClaim({ order_id: "o3", sku: "lab-pass", email: "owner@example.com", tx: "owner-gratis", network: "owner", amount_cents: 49500 });
  assert.deepEqual(verifyClaim(old.token), { ok: false, error: "claim_revoked" });
});

test("C1: resolveOwnerLane ignores emails", () => {
  assert.equal(resolveOwnerLane({ email: "owner@example.com" }).gratis, false);
  assert.equal(resolveOwnerLane({ verifiedEmail: "owner@example.com" }).gratis, false);
  assert.equal(resolveOwnerLane({ ownerRequest: true }).gratis, true);
  assert.equal(resolveOwnerLane({ claimPayload: { owner: true } }).gratis, true);
});

// ---- C2: SKU comes from the claim, never the query string ----
test("C2: ?product= cannot upgrade a cheap claim", async () => {
  const s = signClaim({ order_id: "o4", sku: "lab-check", tx: "0xdef", network: "base", amount_cents: 5 });
  const m = mockRes();
  await verify.default({ method: "GET", headers: {}, url: "/api/access-verify", query: { claim: s.token, product: "lab-pass" } }, m.res);
  const j = m.json();
  assert.equal(j.ok, true);
  assert.equal(j.product_hint, "lab-check");
});

test("C2: skuPriceCheck refuses underpaid catalog SKUs", () => {
  assert.equal(verify.skuPriceCheck({ sku: "lab-pass", amountTotal: 50, mode: "payment" }).ok, false);
  assert.equal(verify.skuPriceCheck({ sku: "lab-pass", amountTotal: 49500, mode: "payment" }).ok, true);
  assert.equal(verify.skuPriceCheck({ sku: "lab-pass", amountTotal: 40000, amountSubtotal: 49500, mode: "payment" }).ok, true, "promo codes discount total, not subtotal");
  assert.equal(verify.skuPriceCheck({ sku: "chamber-month", amountTotal: 0, mode: "subscription", fromMetadata: true }).ok, true, "server-set trial");
  assert.equal(verify.skuPriceCheck({ sku: "chamber-month", amountTotal: 0, mode: "subscription", fromMetadata: false }).ok, false, "buyer-set reference cannot claim a trial");
  assert.equal(verify.skuPriceCheck({ sku: "", amountTotal: 0 }).ok, true);
});

// ---- H3: Solana receipt must pay the right mint to payTo ----
test("H3: solanaReceivedAmount counts only the mint paid to payTo", () => {
  const mint = "USDCmint111", payTo = "LabWallet111";
  const tx = {
    meta: {
      err: null,
      preTokenBalances: [
        { accountIndex: 1, owner: payTo, mint, uiTokenAmount: { amount: "1000" } },
        { accountIndex: 2, owner: "Someone", mint, uiTokenAmount: { amount: "900000" } },
      ],
      postTokenBalances: [
        { accountIndex: 1, owner: payTo, mint, uiTokenAmount: { amount: "496000" } },
        { accountIndex: 2, owner: "Someone", mint, uiTokenAmount: { amount: "405000" } },
      ],
    },
    transaction: { message: { accountKeys: ["Payer", "LabAta", "OtherAta"] } },
  };
  assert.equal(products.solanaReceivedAmount(tx, { payTo, mint }), 495000n);
  assert.equal(products.solanaReceivedAmount(tx, { payTo, mint: "OtherMint" }), 0n);
  assert.equal(products.solanaReceivedAmount(tx, { payTo: "LabAta", mint }), 495000n, "token account as payTo");
  assert.equal(products.solanaReceivedAmount({ ...tx, meta: { ...tx.meta, err: { x: 1 } } }, { payTo, mint }), 0n);
});

// ---- H4: client-controlled X-Forwarded-For no longer picks the identity ----
test("H4: Fly-Client-IP wins; spoofed first XFF entry is ignored", () => {
  assert.equal(cleanIp({ headers: { "fly-client-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4" } }), "198.51.100.7");
  assert.equal(cleanIp({ headers: { "x-forwarded-for": "1.2.3.4, 198.51.100.7" } }), "198.51.100.7");
  assert.equal(cleanIp({ headers: {}, socket: { remoteAddress: "127.0.0.1" } }), "127.0.0.1");
});
