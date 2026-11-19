import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyStripeEvent, blankBook, hasAccess, publicView, loadBook, saveBook, lookupBySession,
} from "./stripe-subscriptions.mjs";

const T0 = 1_800_000_000;
const MONTH = 30 * 86400;

const completed = (over = {}) => ({
  id: "evt_c", type: "checkout.session.completed",
  data: { object: { id: "cs_test_a", mode: "subscription", subscription: "sub_1", customer: "cus_1", metadata: { sku: "chamber-month" }, ...over } },
});
const paid = (id, end, reason = "subscription_cycle", newShape = false) => ({
  id, type: "invoice.paid",
  data: { object: {
    id: "in_" + id, customer: "cus_1", amount_paid: 2000, currency: "usd", billing_reason: reason,
    ...(newShape
      ? { parent: { subscription_details: { subscription: "sub_1", metadata: { sku: "chamber-month" } } } }
      : { subscription: "sub_1" }),
    lines: { data: [{ period: { start: end - MONTH, end } }] },
  } },
});

test("subscribe, renew, payment failure, cancel: grant, extend, keep, revoke", () => {
  const book = blankBook();
  let r = applyStripeEvent(book, completed(), { nowSec: T0 });
  assert.equal(r.action, "granted");
  assert.ok(hasAccess(book.subs.sub_1, T0 + 1));
  r = applyStripeEvent(book, paid("evt_p1", T0 + MONTH, "subscription_create"), { nowSec: T0 });
  assert.equal(r.action, "paid");
  assert.equal(r.sale.amountCents, 2000);
  assert.equal(r.sale.sku, "chamber-month");
  assert.equal(book.subs.sub_1.access_until, T0 + MONTH);
  // month 2 renewal extends access
  r = applyStripeEvent(book, paid("evt_p2", T0 + 2 * MONTH, "subscription_cycle", true), { nowSec: T0 + MONTH });
  assert.equal(r.action, "renewed");
  assert.equal(book.subs.sub_1.access_until, T0 + 2 * MONTH);
  assert.equal(book.subs.sub_1.renewals, 1);
  assert.ok(hasAccess(book.subs.sub_1, T0 + MONTH + 10 * 86400));
  // failed charge: past_due, still on until the paid period ends
  r = applyStripeEvent(book, { id: "evt_f", type: "invoice.payment_failed", data: { object: { id: "in_f", subscription: "sub_1" } } }, { nowSec: T0 + 2 * MONTH - 5 });
  assert.equal(book.subs.sub_1.status, "past_due");
  assert.ok(hasAccess(book.subs.sub_1, T0 + 2 * MONTH - 1));
  assert.ok(!hasAccess(book.subs.sub_1, T0 + 2 * MONTH + 1));
  // cancel revokes right away
  r = applyStripeEvent(book, { id: "evt_d", type: "customer.subscription.deleted", data: { object: { id: "sub_1", status: "canceled", customer: "cus_1", metadata: { sku: "chamber-month" } } } }, { nowSec: T0 + MONTH + 3 });
  assert.equal(r.action, "revoked");
  assert.ok(!hasAccess(book.subs.sub_1, T0 + MONTH + 4));
  assert.equal(publicView(book.subs.sub_1, T0 + MONTH + 4).access, false);
  // a late invoice.paid can never re-open a cancelled plan
  applyStripeEvent(book, paid("evt_late", T0 + 3 * MONTH), { nowSec: T0 + MONTH + 5 });
  assert.ok(!hasAccess(book.subs.sub_1, T0 + MONTH + 6));
});

test("duplicate events and unrelated events change nothing", () => {
  const book = blankBook();
  applyStripeEvent(book, completed(), { nowSec: T0 });
  assert.equal(applyStripeEvent(book, completed(), { nowSec: T0 }).action, "duplicate_event");
  assert.equal(applyStripeEvent(book, { id: "e", type: "checkout.session.completed", data: { object: { mode: "payment" } } }).changed, false);
  assert.equal(applyStripeEvent(book, { id: "e2", type: "charge.refunded", data: { object: {} } }).changed, false);
});

test("subscription.updated: new-shape period end extends, unpaid revokes, cancel_at_period_end kept", () => {
  const book = blankBook();
  applyStripeEvent(book, completed(), { nowSec: T0 });
  applyStripeEvent(book, { id: "u1", type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "active", cancel_at_period_end: true, items: { data: [{ current_period_end: T0 + 40 * 86400, price: { recurring: { interval: "month" } } }] } } } }, { nowSec: T0 });
  assert.equal(book.subs.sub_1.access_until, T0 + 40 * 86400);
  assert.equal(book.subs.sub_1.cancel_at_period_end, true);
  applyStripeEvent(book, { id: "u2", type: "customer.subscription.updated", data: { object: { id: "sub_1", status: "unpaid" } } }, { nowSec: T0 + 50 });
  assert.ok(!hasAccess(book.subs.sub_1, T0 + 51));
});

test("file store: round trip, missing = empty, corrupt fails closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "subs-"));
  const p = join(dir, "b.json");
  assert.deepEqual((await loadBook(p)).subs, {});
  const book = blankBook();
  applyStripeEvent(book, completed(), { nowSec: T0 });
  await saveBook(book, p);
  assert.equal((await lookupBySession("cs_test_a", p)).sub_id, "sub_1");
  await writeFile(p, "{not json");
  await assert.rejects(loadBook(p), /subs_book_corrupt/);
});
