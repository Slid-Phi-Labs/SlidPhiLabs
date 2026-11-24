import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import {
  priceForSku,
  configuredProtocols,
  issueChallenge,
  consumeChallenge,
  detectProtocol,
  settleStripeRail,
  settleAp2,
  settleX402,
  gatewayReceipt,
} from "./lib/payment-gateway.mjs";
import { centsToRaw, SOLANA_USDC_MAINNET } from "./lib/solana-verify.mjs";

const savedEnv = { ...process.env };
const PAYTO = "11111111111111111111111111111111";

before(() => {
  process.env.AUTH_DIR = mkdtempSync(join(tmpdir(), "spl-gw-"));
  process.env.X402_PAY_TO = PAYTO;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.GW_MPP_ENABLED;
  delete process.env.GW_ACP_ENABLED;
  delete process.env.AP2_ISSUER_PUBLIC_KEY;
  delete process.env.GW_AP2_MERCHANT_ID;
  delete process.env.GW_REQUIRE_RIDER;
});

after(() => {
  process.env = { ...savedEnv };
});

describe("gateway — pricing + challenge + replay", () => {
  it("prices from the canonical catalog", () => {
    assert.equal(priceForSku("chamber-month").amount_cents, 2000);
    assert.equal(priceForSku("no-such-sku"), null);
  });

  it("advertises only configured protocols", () => {
    assert.deepEqual(configuredProtocols(process.env), ["x402"]);
  });

  it("issues a 402 challenge whose nonce consumes exactly once", () => {
    const ch = issueChallenge({ sku: "chamber-month", amount_cents: 2000 });
    assert.equal(ch.code, "payment_required");
    assert.equal(ch.accepts[0].protocol, "x402");
    assert.equal(ch.accepts[0].maxAmountRequired, centsToRaw(2000));
    const first = consumeChallenge({ nonce: ch.nonce, sku: "chamber-month", amount_cents: 2000 });
    assert.equal(first.ok, true);
    const replay = consumeChallenge({ nonce: ch.nonce, sku: "chamber-month", amount_cents: 2000 });
    assert.equal(replay.ok, false);
    assert.equal(replay.reason, "unknown_or_replayed_nonce");
  });

  it("rejects nonce reuse across sku or amount", () => {
    const ch = issueChallenge({ sku: "chamber-month", amount_cents: 2000 });
    assert.equal(consumeChallenge({ nonce: ch.nonce, sku: "pcc-pro", amount_cents: 2000 }).reason, "challenge_sku_mismatch");
    const ch2 = issueChallenge({ sku: "chamber-month", amount_cents: 2000 });
    assert.equal(consumeChallenge({ nonce: ch2.nonce, sku: "chamber-month", amount_cents: 1999 }).reason, "challenge_amount_mismatch");
  });

  it("detects each protocol credential shape", () => {
    assert.equal(detectProtocol({ headers: {}, body: { sku: "x", signature: "abc" } }), "x402");
    assert.equal(detectProtocol({ headers: { "payment-credential": "spt_123" }, body: {} }), "mpp");
    assert.equal(detectProtocol({ headers: {}, body: { delegated_token: "pm_1" } }), "acp");
    assert.equal(detectProtocol({ headers: {}, body: { mandate: "a.b.c" } }), "ap2");
    assert.equal(detectProtocol({ headers: {}, body: {} }), null);
  });
});

describe("gateway — card rails (mpp/acp)", () => {
  const okFetch = async () => ({ ok: true, json: async () => ({ id: "pi_1", status: "succeeded", amount: 2000, amount_received: 2000 }) });

  it("fails closed when not configured", async () => {
    const r = await settleStripeRail({ protocol: "mpp", credential: "spt_x", sku: "chamber-month", amount_cents: 2000, nonce: "n", fetchImpl: okFetch });
    assert.equal(r.reason, "protocol_not_configured");
  });

  it("refuses sub-floor card captures and bad credentials", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.GW_MPP_ENABLED = "1";
    const low = await settleStripeRail({ protocol: "mpp", credential: "spt_x", sku: "x", amount_cents: 25, nonce: "n", fetchImpl: okFetch });
    assert.equal(low.reason, "below_min_settlement");
    const bad = await settleStripeRail({ protocol: "mpp", credential: "not-a-token", sku: "x", amount_cents: 2000, nonce: "n", fetchImpl: okFetch });
    assert.equal(bad.reason, "bad_credential");
  });

  it("captures the exact amount on success", async () => {
    const r = await settleStripeRail({ protocol: "mpp", credential: "spt_x", sku: "chamber-month", amount_cents: 2000, nonce: "n", fetchImpl: okFetch });
    assert.equal(r.ok, true);
    assert.equal(r.settled_id, "pi_1");
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.GW_MPP_ENABLED;
  });
});

describe("gateway — ap2 mandates", () => {
  function mandate(claims, keyPair) {
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const head = enc({ alg: "EdDSA", typ: "JWT" });
    const payload = enc(claims);
    const sig = cryptoSign(null, Buffer.from(`${head}.${payload}`), keyPair.privateKey).toString("base64url");
    return `${head}.${payload}.${sig}`;
  }

  it("settles a valid mandate at exact price; rejects below-price and wrong merchant", () => {
    const kp = generateKeyPairSync("ed25519");
    process.env.AP2_ISSUER_PUBLIC_KEY = kp.publicKey.export({ type: "spki", format: "pem" });
    process.env.GW_AP2_MERCHANT_ID = "spl-merchant";
    const base = { merchant_id: "spl-merchant", currency: "usd", nonce: "n1", exp: Math.floor(Date.now() / 1000) + 600, jti: "ap2-1" };
    const good = settleAp2({ mandate: mandate({ ...base, amount_cents: 5000 }, kp), sku: "chamber-month", amount_cents: 2000, nonce: "n1" });
    assert.equal(good.ok, true);
    assert.equal(good.amount_cents, 2000);
    const low = settleAp2({ mandate: mandate({ ...base, amount_cents: 100 }, kp), sku: "chamber-month", amount_cents: 2000, nonce: "n1" });
    assert.equal(low.reason, "mandate_below_price");
    const wrong = settleAp2({ mandate: mandate({ ...base, merchant_id: "other", amount_cents: 5000 }, kp), sku: "chamber-month", amount_cents: 2000, nonce: "n1" });
    assert.equal(wrong.reason, "mandate_merchant_mismatch");
    const tampered = mandate({ ...base, amount_cents: 5000 }, kp).replace(/.$/, "x");
    assert.equal(settleAp2({ mandate: tampered, sku: "chamber-month", amount_cents: 2000, nonce: "n1" }).ok, false);
    delete process.env.AP2_ISSUER_PUBLIC_KEY;
    delete process.env.GW_AP2_MERCHANT_ID;
  });
});

describe("gateway — x402 solana settle", () => {
  it("verifies exact price once, then replay is refused", async () => {
    const sig = "1".repeat(64);
    const adapters = {
      getTransaction: async () => ({
        transfers: [{ mint: SOLANA_USDC_MAINNET, destination: PAYTO, amount_raw: centsToRaw(2000) }],
      }),
    };
    const first = await settleX402({ signature: sig, sku: "chamber-month", amount_cents: 2000, adapters });
    assert.equal(first.ok, true);
    const replay = await settleX402({ signature: sig, sku: "chamber-month", amount_cents: 2000, adapters });
    assert.equal(replay.reason, "already_used");
  });

  it("rejects a wrong-amount transfer", async () => {
    const sig = "2".repeat(64);
    const adapters = {
      getTransaction: async () => ({
        transfers: [{ mint: SOLANA_USDC_MAINNET, destination: PAYTO, amount_raw: centsToRaw(100) }],
      }),
    };
    const r = await settleX402({ signature: sig, sku: "chamber-month", amount_cents: 2000, adapters });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "amount_mismatch");
  });

  it("issues deterministic receipts", () => {
    const r = gatewayReceipt({ protocol: "x402", sku: "chamber-month", amount_cents: 2000, settled_id: "tx1", nonce: "n1" });
    assert.match(r.receipt_id, /^gw_[0-9a-f]{24}$/);
  });
});
