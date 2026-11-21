import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warrant-"));
process.env.WARRANT_DIR = dir;
process.env.WARRANT_SECRET = "test-warrant-secret-32bytes-min";

const {
  hostAllowed,
  issueWarrant,
  verifyWarrant,
  fileReceipt,
  revokeWarrant,
  getWarrant,
  listReceipts,
  reserveWarrant,
} = await import("./warrant.mjs");

test("host allowlist", () => {
  assert.equal(hostAllowed(["www.slidphilabs.com"], "www.slidphilabs.com"), true);
  assert.equal(hostAllowed(["www.slidphilabs.com"], "evil.example"), false);
  assert.equal(hostAllowed(["*"], "anything.test"), true);
  assert.equal(hostAllowed([".slidphilabs.com"], "api.slidphilabs.com"), true);
});

test("demo issue + receipt + budget", () => {
  const issued = issueWarrant({ demo: true, max_usd: 1, max_calls: 2, ttl_seconds: 120 });
  assert.equal(issued.ok, true);
  assert.match(issued.token, /^w1\./);
  assert.equal(issued.warrant.agent_id, "demo");

  const ok = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke" });
  assert.equal(ok.ok, true);

  const blockedHost = verifyWarrant(issued.token, { host: "evil.example", action: "invoke" });
  assert.equal(blockedHost.ok, false);
  assert.equal(blockedHost.reason, "host_not_allowed");

  const r1 = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    usd: 0.4,
    request_sha256: "aa",
    result_sha256: "bb",
  });
  assert.equal(r1.ok, true);
  assert.equal(r1.receipt.warrant_id, issued.warrant.id);
  assert.ok(r1.warrant.remaining_usd < 1);

  const r2 = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    usd: 0.8,
  });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, "usd_exhausted");

  const r3 = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    usd: 0.2,
  });
  assert.equal(r3.ok, true);
  assert.equal(r3.warrant.remaining_calls, 0);

  const r4 = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    usd: 0,
  });
  assert.equal(r4.ok, false);
  assert.equal(r4.reason, "calls_exhausted");

  const listed = listReceipts(issued.warrant.id);
  assert.equal(listed.ok, true);
  assert.equal(listed.receipts.length, 2);

  const rev = revokeWarrant(issued.token);
  assert.equal(rev.ok, true);
  const after = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke" });
  assert.equal(after.ok, false);
  assert.equal(after.reason, "revoked");

  const pub = getWarrant(issued.warrant.id);
  assert.equal(pub.ok, true);
  assert.equal(pub.warrant.revoked, true);
});

test("tamper fails", () => {
  const issued = issueWarrant({ demo: true, ttl_seconds: 60 });
  const bad = issued.token.slice(0, -2) + "xx";
  const v = verifyWarrant(bad);
  assert.equal(v.ok, false);
});


test("delegation chain issues, verifies, and files", () => {
  const issued = issueWarrant({
    demo: true,
    ttl_seconds: 120,
    chain: [{ actor: "demo", mode: "self" }, { actor: "agent-a", mode: "act-for" }],
  });
  assert.equal(issued.ok, true);
  assert.equal(issued.warrant.chain.length, 2);
  assert.equal(issued.warrant.chain[0].mode, "self");
  const badRoot = issueWarrant({ demo: true, ttl_seconds: 120, chain: [{ actor: "someone-else" }] });
  assert.equal(badRoot.ok, false);
  assert.equal(badRoot.reason, "chain_root_mismatch");
  const okA = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke", actor: "agent-a", delegation_mode: "act-for" });
  assert.equal(okA.ok, true);
  const wrongMode = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke", actor: "agent-a", delegation_mode: "act-as" });
  assert.equal(wrongMode.ok, false);
  assert.equal(wrongMode.reason, "mode_mismatch");
  const stranger = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke", actor: "agent-x" });
  assert.equal(stranger.ok, false);
  assert.equal(stranger.reason, "actor_not_in_chain");
  const legacy = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke" });
  assert.equal(legacy.ok, true);
  const r = fileReceipt({
    token: issued.token, action: "invoke", host: "www.slidphilabs.com", usd: 0.1,
    actor: "agent-a", evidence_ids: ["ev1"], parent_receipt: "rcp_parent",
  });
  assert.equal(r.ok, true);
  assert.equal(r.receipt.actor, "agent-a");
  assert.deepEqual(r.receipt.evidence_ids, ["ev1"]);
  assert.equal(r.receipt.parent_receipt, "rcp_parent");
});

test("pre-spend cap: verify with usd + reserve/settle/release", async () => {
  const { reserveWarrant, releaseReservation } = await import("./warrant.mjs");
  const issued = issueWarrant({ demo: true, max_usd: 1, max_calls: 5, ttl_seconds: 120 });

  // Verify alone states the cost but deducts nothing.
  const over = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke", usd: 1.5 });
  assert.equal(over.ok, false);
  assert.equal(over.reason, "usd_exhausted");
  const under = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke", usd: 0.4 });
  assert.equal(under.ok, true);
  assert.equal(under.warrant.remaining_usd, 1);

  // Reserve over budget fails and deducts nothing.
  const badReserve = reserveWarrant({ token: issued.token, host: "www.slidphilabs.com", action: "invoke", usd: 2 });
  assert.equal(badReserve.ok, false);
  assert.equal(badReserve.reason, "usd_exhausted");

  // Reserve deducts immediately; a second reserve against the same balance fails.
  const rsv = reserveWarrant({ token: issued.token, host: "www.slidphilabs.com", action: "invoke", usd: 0.7 });
  assert.equal(rsv.ok, true);
  assert.equal(rsv.warrant.remaining_usd, 0.3);
  assert.equal(rsv.warrant.reserved_usd, 0.7);
  const rsv2 = reserveWarrant({ token: issued.token, host: "www.slidphilabs.com", action: "invoke", usd: 0.4 });
  assert.equal(rsv2.ok, false);

  // Settle via receipt: no double-deduct, one call consumed.
  const settled = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    reservation_id: rsv.reservation.id,
  });
  assert.equal(settled.ok, true);
  assert.equal(settled.receipt.usd, 0.7);
  assert.equal(settled.warrant.remaining_usd, 0.3);
  assert.equal(settled.warrant.reserved_usd, 0);
  assert.equal(settled.warrant.remaining_calls, 4);

  // Settled reservation cannot settle twice.
  const twice = fileReceipt({
    token: issued.token,
    action: "invoke",
    host: "www.slidphilabs.com",
    reservation_id: rsv.reservation.id,
  });
  assert.equal(twice.ok, false);
  assert.equal(twice.reason, "reservation_settled");

  // Release refunds an unsettled reservation.
  const rsv3 = reserveWarrant({ token: issued.token, host: "www.slidphilabs.com", action: "invoke", usd: 0.3 });
  assert.equal(rsv3.ok, true);
  const rel = releaseReservation(rsv3.reservation.id);
  assert.equal(rel.ok, true);
  assert.equal(rel.warrant.remaining_usd, 0.3);
  assert.equal(rel.warrant.reserved_usd, 0);
});

test("five 0.20 reserves then the sixth is refused for budget, not calls", () => {
  const issued = issueWarrant({ demo: true, max_usd: 1, max_calls: 10, ttl_seconds: 900 });
  assert.equal(issued.ok, true);
  for (let i = 0; i < 5; i++) {
    const rsv = reserveWarrant({ token: issued.token, host: "www.slidphilabs.com", action: "invoke", usd: 0.2 });
    assert.equal(rsv.ok, true, `reserve ${i}`);
  }
  const sixth = reserveWarrant({ token: issued.token, host: "www.slidphilabs.com", action: "invoke", usd: 0.2 });
  assert.equal(sixth.ok, false);
  assert.equal(sixth.reason, "usd_exhausted");
  assert.equal(sixth.warrant.remaining_calls, 10);
});

test("an expired warrant is refused before a host check matters", () => {
  const issued = issueWarrant({ demo: true, max_usd: 1, max_calls: 10, ttl_seconds: 900 });
  const file = path.join(dir, "warrants", `${issued.warrant.id}.json`);
  const rec = JSON.parse(fs.readFileSync(file, "utf8"));
  rec.exp = Math.floor(Date.now() / 1000) - 5;
  fs.writeFileSync(file, JSON.stringify(rec));
  const v = verifyWarrant(issued.token, { host: "www.slidphilabs.com", action: "invoke" });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "expired");
});

test("verifyRiderToken uses the configurable URL adapter (no network in tests)", async () => {
  const { verifyRiderToken } = await import("./warrant.mjs");
  assert.deepEqual(await verifyRiderToken(null), { valid: false, reason: "missing_rider" });
  assert.equal((await verifyRiderToken("tok", { verifyUrl: "" })).reason, "rider_verify_unconfigured");
  let seen = null;
  const ok = await verifyRiderToken("tok", {
    verifyUrl: "https://verify.test/rider",
    fetchImpl: async (url, init) => {
      seen = { url, body: JSON.parse(init.body) };
      return { ok: true, status: 200, json: async () => ({ valid: true, rider: { agent_id: "a" } }) };
    },
  });
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.rider, { agent_id: "a" });
  assert.equal(seen.url, "https://verify.test/rider");
  assert.equal(seen.body.rider, "tok");
  const denied = await verifyRiderToken("tok", {
    verifyUrl: "https://verify.test/rider",
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ valid: false, reason: "nope" }) }),
  });
  assert.equal(denied.valid, false);
  assert.equal(denied.reason, "nope");
  const down = await verifyRiderToken("tok", {
    verifyUrl: "https://verify.test/rider",
    fetchImpl: async () => { throw new Error("down"); },
  });
  assert.equal(down.valid, false);
  assert.equal(down.reason, "rider_unreachable");
});

test("two processes cannot both reserve 0.60 of a 1.00 budget", async () => {
  const { spawn } = await import("node:child_process");
  const issued = issueWarrant({ demo: true, max_usd: 1, max_calls: 10, ttl_seconds: 900 });
  const mod = new URL("./warrant.mjs", import.meta.url).href;
  const code = `
    import { reserveWarrant } from ${JSON.stringify(mod)};
    const out = reserveWarrant({ token: process.env.TOK, host: "www.slidphilabs.com", action: "invoke", usd: 0.6 });
    process.stdout.write(JSON.stringify({ ok: !!out.ok, reason: out.reason || "" }));
  `;
  function once() {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
        env: {
          ...process.env,
          TOK: issued.token,
          WARRANT_DIR: dir,
          WARRANT_SECRET: process.env.WARRANT_SECRET,
        },
      });
      let buf = "";
      let err = "";
      child.stdout.on("data", (d) => { buf += d; });
      child.stderr.on("data", (d) => { err += d; });
      child.on("close", (status) => {
        if (status !== 0) reject(new Error(err || buf || String(status)));
        else resolve(JSON.parse(buf));
      });
    });
  }
  const pair = await Promise.all([once(), once()]);
  assert.equal(pair.filter((row) => row.ok).length, 1);
  assert.equal(pair.filter((row) => row.reason === "usd_exhausted").length, 1);
});

test("the same idempotency key reserves once", () => {
  const issued = issueWarrant({ demo: true, max_usd: 1, max_calls: 10, ttl_seconds: 900 });
  const first = reserveWarrant({
    token: issued.token, host: "www.slidphilabs.com", action: "invoke", usd: 0.2, idempotency_key: "job-1",
  });
  const again = reserveWarrant({
    token: issued.token, host: "www.slidphilabs.com", action: "invoke", usd: 0.2, idempotency_key: "job-1",
  });
  assert.equal(first.ok, true);
  assert.equal(again.ok, true);
  assert.equal(again.idempotent, true);
  assert.equal(again.reservation.id, first.reservation.id);
  assert.equal(again.warrant.remaining_usd, 0.8);
  assert.equal(again.warrant.reserved_usd, 0.2);
});

test("a breach webhook posts the reason and stays quiet when unset", async () => {
  const { notifyBreach } = await import("./warrant.mjs");
  const previous = process.env.WARRANT_WEBHOOK_URL;
  delete process.env.WARRANT_WEBHOOK_URL;
  assert.deepEqual(await notifyBreach("usd_exhausted"), { sent: false });
  process.env.WARRANT_WEBHOOK_URL = "https://hooks.test/warrant";
  let seen = null;
  const sent = await notifyBreach("usd_exhausted", { host: "www.slidphilabs.com" }, async (url, init) => {
    seen = { url, body: JSON.parse(init.body) };
    return { ok: true };
  });
  assert.equal(sent.sent, true);
  assert.equal(seen.url, "https://hooks.test/warrant");
  assert.equal(seen.body.event, "warrant.breach");
  assert.equal(seen.body.reason, "usd_exhausted");
  assert.equal(seen.body.token, undefined);
  if (previous === undefined) delete process.env.WARRANT_WEBHOOK_URL;
  else process.env.WARRANT_WEBHOOK_URL = previous;
});

test("a counterparty sees only valid, invalid, expired, or revoked", async () => {
  const { classifyCounterparty } = await import("./warrant.mjs");
  assert.equal(classifyCounterparty({ valid: true, rider: { agent_id: "a" } }).verdict, "valid");
  assert.equal(classifyCounterparty({ valid: false, reason: "invalid_rider" }).verdict, "invalid");
  assert.equal(classifyCounterparty({ valid: false, reason: "expired" }).verdict, "expired");
  assert.equal(classifyCounterparty({ valid: false, reason: "revoked_kid" }).verdict, "revoked");
  assert.equal(classifyCounterparty(null).verdict, "invalid");
});
