import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  addUsage,
  ANON_INCLUDED_BYTES,
  ANON_JOB_CAP,
  ANON_KEY,
  cleanIp,
  identityDay,
  identityFromReq,
  identitySecretKind,
  IPHM_PREFIX,
  monthKey,
  OWNER_INCLUDED_BYTES,
  ownerFromReq,
  readUsage,
  recordRefusal,
} from "./usage-meter.mjs";

test("day and month keys are UTC calendar slices", () => {
  assert.equal(identityDay(new Date("2026-01-15T12:00:00Z")), "2026-01-15");
  assert.equal(monthKey(new Date("2026-03-04T00:00:00Z")), "2026-03");
});

test("quota constants are fail-closed and countable", () => {
  assert.equal(ANON_INCLUDED_BYTES, 10 * 1024 * 1024);
  assert.equal(ANON_KEY, "anon");
  assert.equal(IPHM_PREFIX, "iph:");
  assert.equal(ANON_JOB_CAP, 20);
  assert.ok(OWNER_INCLUDED_BYTES > 1e15);
});

test("secret kind follows the env, weak fallback otherwise", () => {
  const saved = process.env.USAGE_IDENTITY_SECRET;
  delete process.env.USAGE_IDENTITY_SECRET;
  assert.equal(identitySecretKind(), "weak-process");
  process.env.USAGE_IDENTITY_SECRET = "test-secret";
  assert.equal(identitySecretKind(), "env");
  if (saved === undefined) delete process.env.USAGE_IDENTITY_SECRET;
  else process.env.USAGE_IDENTITY_SECRET = saved;
});

test("cleanIp trusts only the proxy-appended last hop", () => {
  assert.equal(
    cleanIp({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }),
    "5.6.7.8",
  );
  assert.equal(
    cleanIp({ headers: {}, socket: { remoteAddress: "9.9.9.9" } }),
    "9.9.9.9",
  );
  assert.equal(cleanIp({}), null);
  assert.equal(cleanIp({ headers: {} }), null);
});

test("paid seat header wins without touching IP logic", () => {
  const id = identityFromReq(
    { headers: { "x-spl-seat": "pcc", "x-spl-seat-id": "abc" } },
    { secret: "s3cr3t-test", day: "2026-01-15" },
  );
  assert.equal(id.key, "seat:pcc:abc");
  assert.equal(id.via, "seat");
});

test("headerless requests share the anon bucket", () => {
  const id = identityFromReq({}, { secret: "s3cr3t-test", day: "2026-01-15" });
  assert.equal(id.key, ANON_KEY);
  assert.equal(id.via, "anon");
});

test("IP identity is deterministic, day-scoped, and PII-free", () => {
  const req = { headers: { "x-forwarded-for": "203.0.113.7" } };
  const opts = { secret: "s3cr3t-test", day: "2026-01-15" };
  const a = identityFromReq(req, opts);
  const b = identityFromReq(req, opts);
  assert.equal(a.key, b.key);
  assert.equal(a.via, "ip");
  assert.ok(a.key.startsWith(`${IPHM_PREFIX}2026-01-15:`));
  assert.match(a.key, /^iph:\d{4}-\d{2}-\d{2}:[0-9a-f]{32}$/);
  assert.ok(!a.key.includes("203.0.113.7"));
  const rotated = identityFromReq(req, { secret: "other", day: "2026-01-15" });
  assert.notEqual(rotated.key, a.key);
});

test("owner lane stays closed without an owner token", () => {
  assert.equal(ownerFromReq({}), false);
  assert.equal(ownerFromReq({ headers: {} }), false);
});

test("usage buckets accumulate in an isolated AUTH_DIR", () => {
  const dir = mkdtempSync(join(tmpdir(), "usage-meter-test-"));
  const saved = process.env.AUTH_DIR;
  process.env.AUTH_DIR = dir;
  try {
    const empty = readUsage("testkey");
    assert.equal(empty.bytes, 0);
    assert.equal(empty.jobs, 0);
    assert.equal(empty.refusals, 0);
    const after = addUsage("testkey", 100);
    assert.equal(after.bytes, 100);
    assert.equal(after.jobs, 1);
    assert.equal(readUsage("testkey").bytes, 100);
    assert.equal(recordRefusal("testkey"), 1);
    assert.equal(readUsage("testkey").refusals, 1);
  } finally {
    if (saved === undefined) delete process.env.AUTH_DIR;
    else process.env.AUTH_DIR = saved;
  }
});
