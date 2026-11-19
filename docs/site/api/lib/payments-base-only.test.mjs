import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = "0xAd3dB8e2b1A311701E6233f17F6d648e4A52287c";
const SOL_VARS = ["X402_PAY_TO", "PAY_SOLANA_ADDRESS", "BLOKZ_SOLANA_ADDRESS"];

test("payment info with only a Base address lists Base and no Solana", async () => {
  for (const k of SOL_VARS) delete process.env[k];
  process.env.X402_PAY_TO_BASE = BASE;
  const { buildPaymentsMatrix, x402ChainsLabel } = await import("./payments-rails.js");
  const m = buildPaymentsMatrix({ headers: { host: "www.slidphilabs.com" } });
  const ids = m.rails.map((r) => r.id);
  assert.ok(!ids.some((id) => id.includes("solana")), ids.join(","));
  const base = m.rails.find((r) => r.id === "x402_base_usdc");
  assert.equal(base.configured, true);
  assert.equal(base.payTo, BASE);
  assert.ok(!m.missing_or_optional.some((id) => id.includes("solana")));
  assert.doesNotMatch(m.note, /Solana/);
  assert.equal(x402ChainsLabel(), "Base USDC");
  assert.equal(m.preferred.agent, "x402_base_usdc");
});
