import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { railReadiness, configTemplate, chooseRails, executeDropPayment, routedChallenge } from "./lib/agentic-commerce-drop.mjs";
import { centsToRaw, SOLANA_USDC_MAINNET } from "./lib/solana-verify.mjs";

const savedEnv = { ...process.env };
const PAYTO = "11111111111111111111111111111111";
const fakeReq = { headers: {} };

before(() => {
  process.env.AUTH_DIR = mkdtempSync(join(tmpdir(), "spl-drop-"));
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

describe("drop — readiness + config", () => {
  it("reports missing env names, never values", () => {
    const r = railReadiness(process.env);
    assert.equal(r.x402.configured, true);
    assert.equal(r.mpp.configured, false);
    assert.deepEqual(r.mpp.missing, ["STRIPE_SECRET_KEY", "GW_MPP_ENABLED=1"]);
    const c = configTemplate(process.env);
    assert.match(c.template, /GW_MPP_ENABLED=1/);
    assert.ok(c.commands.some((x) => x.includes("fly secrets set")));
    assert.ok(!JSON.stringify(c).includes(PAYTO) || c.missing_env.length > 0);
  });

  it("routes by amount: card rails vanish below the floor", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.GW_MPP_ENABLED = "1";
    assert.deepEqual(chooseRails({ amount_cents: 25, env: process.env }), ["x402"]);
    assert.ok(chooseRails({ amount_cents: 2000, env: process.env }).includes("mpp"));
    assert.deepEqual(chooseRails({ amount_cents: 2000, credentialProtocol: "x402", env: process.env }), ["x402"]);
    assert.deepEqual(chooseRails({ amount_cents: 2000, credentialProtocol: "acp", env: process.env }), []);
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.GW_MPP_ENABLED;
  });
});

describe("drop — routed payment flow", () => {
  it("challenges, then settles x402 at the exact price with a receipt", async () => {
    const ch = await executeDropPayment({ req: fakeReq, body: { sku: "chamber-month" } });
    assert.equal(ch.status, 402);
    assert.equal(ch.body.drop.name, "Agentic Commerce Drop");
    assert.equal(ch.body.accepts[0].protocol, "x402");

    const sig = "3".repeat(64);
    const adapters = {
      getTransaction: async () => ({
        transfers: [{ mint: SOLANA_USDC_MAINNET, destination: PAYTO, amount_raw: centsToRaw(2000) }],
      }),
    };
    const paid = await executeDropPayment({
      req: fakeReq,
      body: { sku: "chamber-month", nonce: ch.body.nonce, signature: sig },
      adapters,
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.rail, "x402");
    assert.match(paid.body.receipt.receipt_id, /^gw_/);

    const replay = await executeDropPayment({
      req: fakeReq,
      body: { sku: "chamber-month", nonce: ch.body.nonce, signature: sig },
      adapters,
    });
    assert.equal(replay.status, 402);
    assert.equal(replay.body.error, "unknown_or_replayed_nonce");
  });

  it("refuses an unconfigured rail instead of faking settlement", async () => {
    const ch = routedChallenge({ sku: "chamber-month", amount_cents: 2000, env: process.env });
    const r = await executeDropPayment({
      req: fakeReq,
      body: { sku: "chamber-month", nonce: ch.nonce, payment_credential: "spt_fake" },
    });
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "protocol_not_configured");
  });

  it("settles an AP2 mandate when the issuer key is configured", async () => {
    const kp = generateKeyPairSync("ed25519");
    process.env.AP2_ISSUER_PUBLIC_KEY = kp.publicKey.export({ type: "spki", format: "pem" });
    process.env.GW_AP2_MERCHANT_ID = "spl-merchant";
    const ch = await executeDropPayment({ req: fakeReq, body: { sku: "chamber-month" } });
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const head = enc({ alg: "EdDSA", typ: "JWT" });
    const payload = enc({ merchant_id: "spl-merchant", currency: "usd", nonce: ch.body.nonce, amount_cents: 2000, exp: Math.floor(Date.now() / 1000) + 600, jti: "m1" });
    const sig = cryptoSign(null, Buffer.from(`${head}.${payload}`), kp.privateKey).toString("base64url");
    const paid = await executeDropPayment({
      req: fakeReq,
      body: { sku: "chamber-month", nonce: ch.body.nonce, mandate: `${head}.${payload}.${sig}` },
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.rail, "ap2");
    delete process.env.AP2_ISSUER_PUBLIC_KEY;
    delete process.env.GW_AP2_MERCHANT_ID;
  });
});
