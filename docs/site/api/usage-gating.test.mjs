/** Usage-gating tests: every hosted compression route meters input bytes.
 * Deterministic, offline, isolated meter store. Dual license: AGPL-3.0-or-later
 * OR Slid Phi Labs Commercial. See /LICENSE. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runHostedEncode } from "./lib/hosted-job.mjs";
import { usageGate } from "./lib/usage-meter.mjs";
import { addUsage, readUsage, identityFromReq } from "./lib/usage-meter.mjs";
import archive from "./archive.js";
import decompress from "./decompress.js";
import unarchive from "./unarchive.js";
import specialist from "./specialist.js";
import jsonCompress from "./json-compress.js";
import jsonDecompress from "./json-decompress.js";
import webCodec from "./web-codec.js";
import bench from "./bench.js";
import { FREE_BYTES } from "./suite-pricing.js";

const AUTH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spl-usage-gate-"));
process.env.AUTH_DIR = AUTH_DIR;
process.env.USAGE_IDENTITY_SECRET = "usage-gate-test-secret";
process.env.PULSAR_BIN = path.join(AUTH_DIR, "missing-pulsar");
process.env.LB_BIN = path.join(AUTH_DIR, "missing-lb");

let n = 0;
const ip = () => `10.9.${Math.floor(n / 250)}.${1 + (n++ % 250)}`;
const KEY = { authorization: "Bearer testkey-12345678" };
const req = ({ body = undefined, method = "POST", headers = {}, url = "/api/x" } = {}) => {
  const curr = ip();
  return { method, url, body, headers: { "x-forwarded-for": curr, ...headers }, _ip: curr };
};
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
async function call(handler, opts) {
  const r = req(opts);
  const res = mockRes();
  await handler(r, res);
  let json = null;
  try { json = JSON.parse(res.body); } catch { json = null; }
  return { status: res.statusCode, json, ip: r._ip };
}
/** Past first-1-GB lifetime free edge. */
const exhaustIp = (theIp) => {
  const r = { headers: { "x-forwarded-for": theIp } };
  addUsage(identityFromReq(r).key, FREE_BYTES + 1);
};
const usedOf = (theIp) => readUsage(identityFromReq({ headers: { "x-forwarded-for": theIp } }).key).bytes;

test("helper: usageGate allows fresh callers, paywalls exhausted ones", () => {
  const fresh = req({});
  assert.equal(usageGate(fresh, 100), null);
  exhaustIp(fresh._ip);
  const g = usageGate(fresh, 100);
  assert.equal(g.status, 402);
  assert.equal(g.body.error, "paywall");
  assert.ok(g.body.plain);
  assert.ok(g.body.buy.gc_month);
});

test("fill frames are metered like everything else", async () => {
  const r = req({});
  const out = await runHostedEncode(r, Buffer.alloc(100));
  assert.equal(out.status, 200);
  assert.equal(usedOf(r._ip), 100);
});

test("archive: over-quota refuses 402 before encoding", async () => {
  const r = req({ body: { files: [{ path: "a.bin", data_b64: Buffer.from("hello world").toString("base64") }] }, headers: KEY });
  exhaustIp(r._ip);
  const t = await call(archive, { body: r.body, headers: { ...KEY, "x-forwarded-for": r._ip } });
  assert.equal(t.status, 402);
  assert.equal(t.json.error, "paywall");
});

test("archive: happy path records total input bytes", async () => {
  const raw = Buffer.alloc(64);
  const t = await call(archive, {
    body: { files: [{ path: "z.bin", data_b64: raw.toString("base64") }] },
    headers: KEY,
  });
  assert.equal(t.status, 200);
  assert.equal(t.json.ok, true);
  assert.equal(usedOf(t.ip), raw.length);
});

test("decompress: over-quota refuses 402", async () => {
  const r2 = req({ body: { packed_b64: "eA==" }, headers: KEY });
  exhaustIp(r2._ip);
  const t2 = await call(decompress, { body: r2.body, headers: { ...KEY, "x-forwarded-for": r2._ip } });
  assert.equal(t2.status, 402);
  assert.equal(t2.json.error, "paywall");
});

test("decompress: happy path records packed bytes", async () => {
  const encIp = ip();
  const enc = await runHostedEncode({ headers: { "x-forwarded-for": encIp } }, Buffer.alloc(48));
  assert.equal(enc.status, 200);
  const frame = enc.body.packed_b64;
  const t = await call(decompress, { body: { packed_b64: frame }, headers: KEY });
  assert.equal(t.status, 200);
  assert.equal(t.json.ok, true);
  assert.equal(usedOf(t.ip), Buffer.from(frame, "base64").length);
});

test("specialist decode: over-quota refuses 402", async () => {
  const r = req({ body: { op: "decode", data_b64: "eA==" }, headers: KEY });
  exhaustIp(r._ip);
  const t = await call(specialist, { body: r.body, headers: { ...KEY, "x-forwarded-for": r._ip } });
  assert.equal(t.status, 402);
  assert.equal(t.json.error, "paywall");
});

test("unarchive round-trips through archive bytes within allowance", async () => {
  const a = await call(archive, {
    body: { files: [{ path: "z.bin", data_b64: Buffer.alloc(32).toString("base64") }] },
    headers: KEY,
  });
  assert.equal(a.status, 200);
  const u = await call(unarchive, { body: { packed_b64: a.json.packed_b64 }, headers: KEY });
  assert.equal(u.status, 200);
  assert.equal(u.json.ok, true);
  assert.ok(usedOf(u.ip) > 0);
});

test("unarchive: over-quota refuses 402 on valid archive bytes", async () => {
  const a = await call(archive, {
    body: { files: [{ path: "z.bin", data_b64: Buffer.alloc(32).toString("base64") }] },
    headers: KEY,
  });
  const r = req({ body: { packed_b64: a.json.packed_b64 }, headers: KEY });
  exhaustIp(r._ip);
  const t = await call(unarchive, { body: r.body, headers: { ...KEY, "x-forwarded-for": r._ip } });
  assert.equal(t.status, 402);
  assert.equal(t.json.error, "paywall");
});

test("json-compress: over-quota refuses 402, happy path records", async () => {
  const r = req({ body: { value: { a: 1 } } });
  exhaustIp(r._ip);
  const t = await call(jsonCompress, { body: r.body, headers: { "x-forwarded-for": r._ip } });
  assert.equal(t.status, 402);
  const h = await call(jsonCompress, { body: { value: { hello: "world", n: 7 } } });
  assert.equal(h.status, 200);
  assert.ok(usedOf(h.ip) > 0);
});

test("json-decompress round-trips and records", async () => {
  const h = await call(jsonCompress, { body: { value: { a: [1, 2, 3] } } });
  assert.equal(h.status, 200);
  const d = await call(jsonDecompress, { body: { packed_b64: h.json.packed_b64 } });
  assert.equal(d.status, 200);
  assert.equal(d.json.ok, true);
  assert.ok(usedOf(d.ip) > 0);
});

test("web-codec classic compress records input bytes", async () => {
  const t = await call(webCodec, {
    body: { op: "compress", engine: "classic", data: "hello world hello world", encoding: "utf8" },
  });
  assert.equal(t.status, 200);
  assert.equal(t.json.ok, true);
  assert.ok(usedOf(t.ip) > 0);
});

test("web-codec: over-quota refuses 402 before work", async () => {
  const r = req({ body: { op: "compress", engine: "classic", data: "hello", encoding: "utf8" } });
  exhaustIp(r._ip);
  const t = await call(webCodec, { body: r.body, headers: { "x-forwarded-for": r._ip } });
  assert.equal(t.status, 402);
  assert.equal(t.json.error, "paywall");
});

test("bench: over-quota refuses 402 without running engines", async () => {
  const r = req({ body: {}, url: "/api/bench" });
  exhaustIp(r._ip);
  const t = await call(bench, { body: r.body, url: "/api/bench", headers: { "x-forwarded-for": r._ip } });
  assert.equal(t.status, 402);
  assert.equal(t.json.error, "paywall");
});
