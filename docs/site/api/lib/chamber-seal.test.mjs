/** Chamber seal stage tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sealEnvelope,
  openEnvelope,
  CHAMBER_MAGIC,
  CHAMBER_SEAL_VERSION,
} from "./chamber-seal.mjs";

const KEY = "0000000000000000000000000000000000000000000000000000000000000000"; // test-only fixture key (all zeros; never a real key)
const OTHER = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const OBJ = { sku: "chamber-year", usd: 200, note: "two-key JSON seal" };

test("seal then open round-trips the object", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  assert.equal(env.magic, CHAMBER_MAGIC);
  assert.equal(env.v, 1);
  assert.match(env.sha256, /^[0-9a-f]{64}$/);
  const out = openEnvelope(env, { keyHex: KEY });
  assert.equal(out.ok, true);
  assert.deepEqual(out.obj, OBJ);
});

test("tampered ciphertext fails closed", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  const bad = { ...env, ct: env.ct.slice(0, -4) + "AAAA" };
  const out = openEnvelope(bad, { keyHex: KEY });
  assert.equal(out.ok, false);
});

test("wrong key fails closed", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  const out = openEnvelope(env, { keyHex: OTHER });
  assert.equal(out.ok, false);
});

test("bad magic and version are refused", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  assert.equal(openEnvelope({ ...env, magic: "NOPE" }, { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope({ ...env, v: 99 }, { keyHex: KEY }).ok, false);
});

test("missing key fails closed on both ends", () => {
  assert.equal(sealEnvelope(OBJ, {}), null);
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  assert.equal(openEnvelope(env, {}).ok, false);
});

test("version constant is pinned", () => {
  assert.match(CHAMBER_SEAL_VERSION, /^\d+\.\d+\.\d+$/);
});

test("empty object and non-object open are refused", () => {
  assert.equal(openEnvelope({}, { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope([], { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope(null, { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope(undefined, { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope("ACNCH1", { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope(1, { keyHex: KEY }).ok, false);
});

test("truncated auth tag is refused", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  assert.equal(typeof env.tag, "string");
  assert.ok(env.tag.length > 4);
  const short = env.tag.slice(0, -4);
  assert.notEqual(short, env.tag);
  assert.equal(openEnvelope({ ...env, tag: short }, { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope({ ...env, tag: env.tag.slice(0, 4) }, { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope({ ...env, tag: "" }, { keyHex: KEY }).ok, false);
});

test("payload smaller than 8 bytes seals to null", () => {
  assert.equal(Buffer.byteLength(JSON.stringify({}), "utf8"), 2);
  assert.equal(sealEnvelope({}, { keyHex: KEY }), null);
  assert.equal(Buffer.byteLength(JSON.stringify({ a: 1 }), "utf8"), 7);
  assert.equal(sealEnvelope({ a: 1 }, { keyHex: KEY }), null);
  assert.equal(Buffer.byteLength(JSON.stringify("abcde"), "utf8"), 7);
  assert.equal(sealEnvelope("abcde", { keyHex: KEY }), null);
  assert.equal(Buffer.byteLength(JSON.stringify(null), "utf8"), 4);
  assert.equal(sealEnvelope(null, { keyHex: KEY }), null);
  const eight = "abcdef";
  assert.equal(Buffer.byteLength(JSON.stringify(eight), "utf8"), 8);
  const sealed = sealEnvelope(eight, { keyHex: KEY });
  assert.notEqual(sealed, null);
  const opened = openEnvelope(sealed, { keyHex: KEY });
  assert.equal(opened.ok, true);
  assert.deepEqual(opened.obj, eight);
});

test("sha256 mismatch refuses", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY });
  const last = env.sha256.slice(-1);
  const flipped = env.sha256.slice(0, -1) + (last === "0" ? "1" : "0");
  assert.notEqual(flipped, env.sha256);
  assert.equal(openEnvelope({ ...env, sha256: flipped }, { keyHex: KEY }).ok, false);
});

test("two keys open and one key does not", () => {
  const env = sealEnvelope(OBJ, { keyHex: KEY, keyHex2: OTHER });
  assert.equal(env.v, 2);
  assert.equal(openEnvelope(env, { keyHex: KEY, keyHex2: OTHER }).ok, true);
  assert.equal(openEnvelope(env, { keyHex: KEY }).ok, false);
  assert.equal(openEnvelope(env, { keyHex: KEY, keyHex2: KEY }).ok, false);
  const v1 = sealEnvelope(OBJ, { keyHex: KEY });
  assert.equal(v1.v, 1);
  assert.equal(openEnvelope(v1, { keyHex: KEY }).ok, true);
});
