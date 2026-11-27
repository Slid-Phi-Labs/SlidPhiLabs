/** eval-card route tests: offline FIRST suites, gated + metered. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import evalCard from "./eval-card.js";
import { readUsage, identityFromReq } from "./lib/usage-meter.mjs";
import { FREE_BYTES } from "./suite-pricing.js";

const AUTH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spl-eval-card-"));
process.env.AUTH_DIR = AUTH_DIR;
process.env.USAGE_IDENTITY_SECRET = "eval-card-test-secret";

const req = ({ body = undefined, method = "POST", headers = {}, url = "/api/eval-card", ip = "10.11.0.1" } = {}) => ({
  method, url, body, headers: { "x-forwarded-for": ip, ...headers },
});
function mockRes() {
  const chunks = [];
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    write(c) { chunks.push(String(c)); return true; },
    end(c) { if (c !== undefined) chunks.push(String(c)); this.body = chunks.join(""); this.ended = true; return this; },
  };
}
async function call(opts) {
  const r = req(opts);
  const res = mockRes();
  await evalCard(r, res);
  let json = null;
  try { json = JSON.parse(res.body); } catch { json = null; }
  return { status: res.statusCode, json, ip: r.headers["x-forwarded-for"] };
}
const usedOf = (theIp) => readUsage(identityFromReq({ headers: { "x-forwarded-for": theIp } }).key).bytes;

test("GET describes the eval door", async () => {
  const t = await call({ method: "GET" });
  assert.equal(t.status, 200);
  assert.equal(t.json.product, "eval-card");
});

test("POST runs the suites and returns a digest-verified card", async () => {
  const t = await call({ body: {}, ip: "10.11.0.2" });
  assert.equal(t.status, 200);
  assert.equal(t.json.ok, true);
  assert.equal(t.json.card.ok, true);
  assert.match(t.json.card.digest, /^[a-f0-9]{64}$/);
  assert.ok(t.json.card.quote);
  assert.ok(usedOf(t.ip) >= 2);
});

test("bad spec fails closed", async () => {
  const t = await call({ body: "not-json{{{", ip: "10.11.0.3" });
  assert.equal(t.status, 400);
  const t2 = await call({ body: 42, ip: "10.11.0.4" });
  assert.equal(t2.status, 400);
});

test("over-quota refuses 402 without running suites", async () => {
  const { addUsage } = await import("./lib/usage-meter.mjs");
  const theIp = "10.11.0.9";
  addUsage(identityFromReq({ headers: { "x-forwarded-for": theIp } }).key, FREE_BYTES + 1);
  const t = await call({ body: {}, ip: theIp });
  assert.equal(t.status, 402);
  assert.equal(t.json.error, "paywall");
});
