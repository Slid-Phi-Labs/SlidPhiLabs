/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Stripe subscription access book (0.1.0).
 *
 * The webhook feeds verified Stripe events into applyStripeEvent(). The book
 * keeps one record per Stripe subscription: sku, customer, status and
 * access_until (epoch seconds). Access is on while status is active,
 * trialing or past_due AND access_until is still in the future.
 *
 *   checkout.session.completed (mode=subscription) -> grant (provisional, one interval)
 *   invoice.paid                                   -> extend access to the paid period end
 *   invoice.payment_failed                         -> past_due, access runs to the paid period end
 *   customer.subscription.updated                  -> status + period end; ended states revoke
 *   customer.subscription.deleted                  -> revoke now
 *
 * Handles both webhook payload shapes (pre-2025 `invoice.subscription`,
 * `subscription.current_period_end`, and 2025+ `invoice.parent.subscription_details`,
 * `subscription.items.data[].current_period_end`). Pure reducer + small
 * fail-closed file store at STRIPE_SUBS_PATH (default /data/stripe-subs.json).
 * No PII: no email, no names. Customer id only.
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const STRIPE_SUBS_VERSION = "0.1.0";
export const SUB_EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];
const INTERVAL_SEC = { month: 31 * 86400, year: 366 * 86400 };
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
const ENDED_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

const bookPath = () => process.env.STRIPE_SUBS_PATH || "/data/stripe-subs.json";

export function blankBook() {
  return { version: STRIPE_SUBS_VERSION, subs: {}, by_session: {}, events: {} };
}

/** Missing file = empty book. Corrupt file throws, never a silent blank book. */
export async function loadBook(path = bookPath()) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") return blankBook();
    throw new Error("subs_book_unreadable");
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("subs_book_corrupt");
  }
  if (!data || typeof data !== "object" || typeof data.subs !== "object") throw new Error("subs_book_corrupt");
  data.by_session = data.by_session || {};
  data.events = data.events || {};
  return data;
}

export async function saveBook(book, path = bookPath()) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, JSON.stringify(book), { encoding: "utf8", mode: 0o600 });
  await rename(tmp, path);
}

function idOf(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.id === "string") return v.id;
  return null;
}

function invoiceSubscriptionId(inv) {
  return (
    idOf(inv.subscription) ||
    idOf(inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) ||
    null
  );
}

function invoicePeriodEnd(inv) {
  const lines = (inv.lines && inv.lines.data) || [];
  let end = 0;
  for (const l of lines) {
    const e = Number(l && l.period && l.period.end) || 0;
    if (e > end) end = e;
  }
  return end || Number(inv.period_end) || 0;
}

function invoiceSku(inv) {
  const meta = (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.metadata) ||
    inv.subscription_details?.metadata || {};
  if (meta.sku) return String(meta.sku);
  for (const l of (inv.lines && inv.lines.data) || []) {
    if (l && l.metadata && l.metadata.sku) return String(l.metadata.sku);
  }
  return null;
}

function subPeriodEnd(sub) {
  let end = Number(sub.current_period_end) || 0;
  for (const it of (sub.items && sub.items.data) || []) {
    const e = Number(it && it.current_period_end) || 0;
    if (e > end) end = e;
  }
  return end;
}

function subInterval(sub) {
  for (const it of (sub.items && sub.items.data) || []) {
    const iv = it?.price?.recurring?.interval || it?.plan?.interval;
    if (iv) return iv;
  }
  return null;
}

function upsert(book, subId) {
  if (!book.subs[subId]) book.subs[subId] = { sub_id: subId, status: "incomplete", access_until: 0, sku: null, customer: null };
  return book.subs[subId];
}

/**
 * Pure: apply one verified Stripe event to the book. Returns
 * { changed, sub_id?, action, sale? } where sale is a ledger line to record
 * (invoice.paid only). Unknown or unrelated events return { changed:false }.
 */
export function applyStripeEvent(book, event, { nowSec = Math.floor(Date.now() / 1000), intervalFor } = {}) {
  if (!event || typeof event !== "object" || !SUB_EVENTS.includes(event.type)) {
    return { changed: false, action: "ignored" };
  }
  if (event.id && book.events[event.id]) return { changed: false, action: "duplicate_event" };
  const o = (event.data && event.data.object) || {};
  let out = { changed: false, action: "ignored" };

  if (event.type === "checkout.session.completed") {
    if (o.mode !== "subscription") return { changed: false, action: "not_subscription" };
    const subId = idOf(o.subscription);
    if (!subId) return { changed: false, action: "no_subscription" };
    const r = upsert(book, subId);
    const sku = (o.metadata && o.metadata.sku) || r.sku;
    r.sku = sku || null;
    r.customer = idOf(o.customer) || r.customer;
    r.session_id = o.id || r.session_id || null;
    if (!ENDED_STATUSES.has(r.status)) {
      r.status = r.status === "past_due" ? r.status : "active";
      const iv = (intervalFor && intervalFor(sku)) || "month";
      const provisional = nowSec + (INTERVAL_SEC[iv] || INTERVAL_SEC.month);
      if (!r.access_until || r.access_until < nowSec) {
        r.access_until = provisional;
        r.provisional = true;
      }
    }
    if (o.id) book.by_session[o.id] = subId;
    out = { changed: true, action: "granted", sub_id: subId };
  } else if (event.type === "invoice.paid") {
    const subId = invoiceSubscriptionId(o);
    if (!subId) return { changed: false, action: "no_subscription" };
    const r = upsert(book, subId);
    r.customer = idOf(o.customer) || r.customer;
    r.sku = r.sku || invoiceSku(o);
    const end = invoicePeriodEnd(o);
    if (!ENDED_STATUSES.has(r.status)) {
      r.status = "active";
      if (end && (r.provisional || end > (r.access_until || 0))) r.access_until = end;
      if (end) r.provisional = false;
    }
    r.last_invoice = o.id || null;
    r.renewals = (r.renewals || 0) + (o.billing_reason === "subscription_cycle" ? 1 : 0);
    out = {
      changed: true,
      action: o.billing_reason === "subscription_cycle" ? "renewed" : "paid",
      sub_id: subId,
      sale: o.id && Number(o.amount_paid) > 0
        ? { sku: r.sku || "subscription", amountCents: Number(o.amount_paid), currency: o.currency || "usd", orderId: o.id, rail: "stripe_subscription" }
        : null,
    };
  } else if (event.type === "invoice.payment_failed") {
    const subId = invoiceSubscriptionId(o);
    if (!subId) return { changed: false, action: "no_subscription" };
    const r = upsert(book, subId);
    r.customer = idOf(o.customer) || r.customer;
    if (!ENDED_STATUSES.has(r.status)) r.status = "past_due";
    out = { changed: true, action: "payment_failed", sub_id: subId };
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subId = o.id;
    if (!subId) return { changed: false, action: "no_subscription" };
    const r = upsert(book, subId);
    r.customer = idOf(o.customer) || r.customer;
    r.sku = (o.metadata && o.metadata.sku) || r.sku;
    r.interval = subInterval(o) || r.interval || null;
    r.cancel_at_period_end = !!o.cancel_at_period_end;
    const status = event.type === "customer.subscription.deleted" ? "canceled" : String(o.status || r.status);
    r.status = status;
    if (ENDED_STATUSES.has(status)) {
      r.access_until = Math.min(r.access_until || nowSec, nowSec);
      r.revoked_at = nowSec;
      out = { changed: true, action: "revoked", sub_id: subId };
    } else {
      const end = subPeriodEnd(o);
      if (status === "active" || status === "trialing") {
        if (end && (r.provisional || end > (r.access_until || 0))) r.access_until = end;
        if (end) r.provisional = false;
      }
      out = { changed: true, action: "updated", sub_id: subId };
    }
  }
  if (out.changed && event.id) {
    book.events[event.id] = nowSec;
    const ids = Object.keys(book.events);
    if (ids.length > 5000) for (const k of ids.slice(0, ids.length - 5000)) delete book.events[k];
  }
  return out;
}

export function hasAccess(record, nowSec = Math.floor(Date.now() / 1000)) {
  if (!record) return false;
  return LIVE_STATUSES.has(record.status) && Number(record.access_until) > nowSec;
}

export function publicView(record, nowSec = Math.floor(Date.now() / 1000)) {
  if (!record) return null;
  return {
    sub_id: record.sub_id,
    sku: record.sku,
    status: record.status,
    access: hasAccess(record, nowSec),
    access_until: record.access_until ? new Date(record.access_until * 1000).toISOString() : null,
    cancel_at_period_end: !!record.cancel_at_period_end,
    renewals: record.renewals || 0,
  };
}

export async function lookupBySession(sessionId, path = bookPath()) {
  const book = await loadBook(path);
  const subId = book.by_session[sessionId];
  return subId ? book.subs[subId] || null : null;
}

export async function lookupBySub(subId, path = bookPath()) {
  const book = await loadBook(path);
  return book.subs[subId] || null;
}
