/** Usage meter owner tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signClaim } from "./x402-claim.mjs";
import { ownerFromReq, meterSnapshot, OWNER_INCLUDED_BYTES } from "./usage-meter.mjs";

process.env.X402_CLAIM_SECRET = "test-owner-secret";
process.env.AUTH_DIR = mkdtempSync(join(tmpdir(), "usage-owner-test-"));
process.env.SPL_OWNER_TOKEN = "o".repeat(40);
process.env.SPL_OWNER_EMAILS = "owner@example.com";

const req = (headers) => ({ headers });
function claimReq(fields) {
  const s = signClaim({ order_id: "ord-owner-1", sku: "gc-month", tx: "0xabc", network: "base", amount_cents: 0, ...fields });
  assert.equal(s.ok, true);
  return req({ authorization: "Bearer " + s.token });
}

test("owner-flagged claim and owner token bypass the meter", () => {
  assert.equal(ownerFromReq(claimReq({ owner: true, tx: "owner-gratis", network: "owner" })), true);
  assert.equal(ownerFromReq(req({ "x-spl-owner-token": process.env.SPL_OWNER_TOKEN })), true);
  const snap = meterSnapshot(claimReq({ owner: true, tx: "owner-gratis", network: "owner" }), 10 * 1024 * 1024 * 1024);
  assert.equal(snap.identity, "owner");
  assert.equal(snap.included_bytes, OWNER_INCLUDED_BYTES);
  assert.equal(snap.over, false);
});

test("an owner email inside a claim is not owner (security fix 2026-11-22)", () => {
  assert.equal(ownerFromReq(claimReq({ email: "owner@example.com" })), false);
  assert.equal(ownerFromReq(claimReq({ email: "owner@example.com", tx: "owner-gratis", network: "owner" })), false);
});

test("stranger claims and anonymous stay metered", () => {
  assert.equal(ownerFromReq(claimReq({ email: "someone@else.com" })), false);
  assert.equal(ownerFromReq(req({})), false);
  assert.equal(ownerFromReq(req({ authorization: "Bearer garbage" })), false);
  assert.equal(ownerFromReq(req({ "x-spl-owner-token": "wrong" })), false);
  const snap = meterSnapshot(req({}), 10 * 1024 * 1024 * 1024);
  assert.notEqual(snap.identity, "owner");
  assert.equal(snap.over, true);
});
