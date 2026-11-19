import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SECRET = "whsec_test_step19";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
const LEDGER = join(await mkdtemp(join(tmpdir(), "wh-")), "sales.jsonl");
process.env.SALES_LEDGER_PATH = LEDGER;
const handler = (await import("./stripe-webhook.js")).default;

function sign(raw) {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(k, v) { this.headers[k] = v; },
    end(s) { this.body = s; },
  };
}

async function post(event, { sig, secret = true } = {}) {
  if (!secret) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  const raw = Buffer.from(JSON.stringify(event));
  const req = {
    method: "POST",
    headers: { "stripe-signature": sig === undefined ? sign(raw) : sig },
    rawBody: raw,
    body: event,
  };
  const res = fakeRes();
  await handler(req, res);
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

const completed = (id) => ({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id, payment_status: "paid", amount_total: 900, currency: "usd", metadata: { sku: "try-gate" } } },
});

test("405 on GET, 503 without secret, 400 on bad signature", async () => {
  const res = fakeRes();
  await handler({ method: "GET", headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 405);
  const r = await post(completed("cs_x"), { secret: false });
  assert.equal(r.status, 503);
  const bad = await post(completed("cs_x"), { sig: "t=1,v1=00" });
  assert.equal(bad.status, 400);
});

test("records once, replays dedupe, ledger holds one line", async () => {
  const first = await post(completed("cs_dup1"));
  assert.equal(first.status, 200);
  assert.equal(first.body.recorded, true);
  const replay = await post(completed("cs_dup1"));
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  const lines = (await readFile(LEDGER, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).order_id, "cs_dup1");
});

test("unreadable ledger answers 500 and writes nothing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "whdir-"));
  process.env.SALES_LEDGER_PATH = dir;
  try {
    const r = await post(completed("cs_broken"));
    assert.equal(r.status, 500);
    assert.equal(r.body.error, "ledger_unreadable");
  } finally {
    process.env.SALES_LEDGER_PATH = LEDGER;
  }
});

test("ignored events ack 200 and leave an audit line outside the ledger", async () => {
  const before = await readFile(LEDGER, "utf8");
  const r = await post({ id: "evt_9", type: "charge.refunded", data: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.ignored, true);
  assert.equal(await readFile(LEDGER, "utf8"), before);
  const audit = await readFile(join(dirname(LEDGER), "webhook-audit.jsonl"), "utf8");
  const last = JSON.parse(audit.trim().split("\n").pop());
  assert.equal(last.kind, "webhook_ignored");
  assert.equal(last.reason, "unhandled_type");
});

test("subscription events: grant, month-2 renewal extends and records once, cancel revokes", async () => {
  const { mkdtemp: mk } = await import("node:fs/promises");
  const SUBS = join(await mk(join(tmpdir(), "whs-")), "subs.json");
  process.env.STRIPE_SUBS_PATH = SUBS;
  const { lookupBySession, hasAccess } = await import("./lib/stripe-subscriptions.mjs");
  const now = Math.floor(Date.now() / 1000);
  const r1 = await post({ id: "evt_s1", type: "checkout.session.completed", data: { object: { id: "cs_test_sub", mode: "subscription", subscription: "sub_w", customer: "cus_w", payment_status: "paid", metadata: { sku: "rider-solo" } } } });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.action, "granted");
  const inv = (id, end, reason) => ({ id, type: "invoice.paid", data: { object: { id: "in_" + id, subscription: "sub_w", customer: "cus_w", amount_paid: 1200, currency: "usd", billing_reason: reason, lines: { data: [{ period: { end } }] } } } });
  await post(inv("evt_s2", now + 30 * 86400, "subscription_create"));
  const r3 = await post(inv("evt_s3", now + 60 * 86400, "subscription_cycle"));
  assert.equal(r3.body.action, "renewed");
  const again = await post(inv("evt_s3", now + 60 * 86400, "subscription_cycle"));
  assert.equal(again.body.action, "duplicate_event");
  let rec = await lookupBySession("cs_test_sub");
  assert.equal(rec.access_until, now + 60 * 86400);
  assert.ok(hasAccess(rec));
  const ledger = await readFile(LEDGER, "utf8");
  assert.equal((ledger.match(/in_evt_s3/g) || []).length, 1);
  const r4 = await post({ id: "evt_s4", type: "customer.subscription.deleted", data: { object: { id: "sub_w", status: "canceled", customer: "cus_w" } } });
  assert.equal(r4.body.action, "revoked");
  rec = await lookupBySession("cs_test_sub");
  assert.ok(!hasAccess(rec));
});

test("rotation: a second comma-separated signing secret is accepted", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_old_one," + SECRET;
  const raw = Buffer.from(JSON.stringify({ id: "evt_rot", type: "ping", data: { object: {} } }));
  const res = fakeRes();
  await handler({ method: "POST", headers: { "stripe-signature": sign(raw) }, rawBody: raw, body: {} }, res);
  assert.equal(res.statusCode, 200);
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});
