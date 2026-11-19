/** x402-suite: a Base-only receiving address is enough to quote a 402. */
import test from "node:test";
import assert from "node:assert/strict";

process.env.X402_PAY_TO = "";
process.env.X402_PAY_TO_BASE = "0x000000000000000000000000000000000000dEaD";
const handler = (await import("./x402-suite.js")).default;

function mockRes() {
  let body = "";
  return {
    res: { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = String(v); }, end(d) { if (d !== undefined) body += String(d); } },
    json: () => JSON.parse(body),
  };
}

test("Base payTo only: 402 with a Base accept, not 503", async () => {
  const m = mockRes();
  await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.77" }, query: {}, url: "/api/x402-suite",
    body: { product: "auto", op: "compress", bytes: 20e9, data_class: "text" } }, m.res);
  assert.equal(m.res.statusCode, 402, JSON.stringify(m.json()).slice(0, 300));
  const accepts = m.json().accepts || [];
  assert.ok(accepts.some((a) => a.network === "eip155:8453" && a.payTo === process.env.X402_PAY_TO_BASE));
});

test("discovery says configured when only Base is set", async () => {
  const m = mockRes();
  await handler({ method: "GET", headers: {}, query: {}, url: "/api/x402-suite" }, m.res);
  assert.equal(m.json().payment.configured, true);
  assert.equal(m.json().payment.base.configured, true);
});
