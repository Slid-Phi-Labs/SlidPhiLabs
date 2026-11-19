/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * POST /api/stripe-webhook — Stripe event receiver (0.2.0).
 *
 * Verifies the Stripe-Signature over the EXACT request bytes (server attaches
 * req.rawBody). Missing signing secret fails closed with 503.
 *
 * One-time sales: checkout.session.completed (mode=payment) records the sale
 * to the local ledger, deduped by order id (access-verify also records on
 * redirect-back).
 *
 * Subscriptions (0.2.0): checkout.session.completed (mode=subscription),
 * invoice.paid, invoice.payment_failed, customer.subscription.updated and
 * customer.subscription.deleted feed the subscription access book
 * (lib/stripe-subscriptions.mjs): grant, extend on each paid renewal, mark
 * past_due on a failed charge, revoke on cancel. Paid invoices are recorded
 * to the sales ledger by invoice id. Unknown events are acked (200, ignored)
 * so Stripe stops retrying.
 *
 * STRIPE_WEBHOOK_SECRET may hold more than one whsec_ value, comma-separated,
 * so one endpoint can accept both the old and the new signing secret during
 * a rotation.
 */
import {
  verifyStripeSignature,
  extractStripeSale,
  STRIPE_WEBHOOK_VERSION,
} from "./lib/stripe-webhook-verify.mjs";
import { recordSale, hasOrderId, auditWebhookIgnored } from "./lib/sales-ledger.mjs";
import { SUB_EVENTS, applyStripeEvent, loadBook, saveBook } from "./lib/stripe-subscriptions.mjs";
import { subscriptionInterval } from "./lib/payments-rails.js";

export const WEBHOOK_HANDLER_VERSION = "0.2.0";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

// One writer at a time for the subscription book (single Node process).
let chain = Promise.resolve();
function serialize(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function recordOnce(sale) {
  if (!sale || !sale.orderId) return { ok: true, skipped: true };
  if (await hasOrderId(sale.orderId)) return { ok: true, duplicate: true };
  return recordSale(sale);
}

async function handleSubscriptionEvent(event) {
  return serialize(async () => {
    const book = await loadBook();
    const out = applyStripeEvent(book, event, { intervalFor: (sku) => subscriptionInterval(sku) });
    if (out.changed) await saveBook(book);
    if (out.sale) {
      const r = await recordOnce(out.sale);
      if (!r.ok) throw new Error("ledger_write_failed");
    }
    return out;
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "post_only" });
  const secrets = String(process.env.STRIPE_WEBHOOK_SECRET || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!secrets.length) return json(res, 503, { ok: false, error: "webhook_not_configured" });
  const raw = req.rawBody !== undefined ? req.rawBody : req.body;
  let v = { ok: false, reason: "bad_signature" };
  for (const secret of secrets) {
    v = verifyStripeSignature(raw, req.headers["stripe-signature"], secret);
    if (v.ok) break;
  }
  if (!v.ok) return json(res, 400, { ok: false, error: "bad_signature", reason: v.reason });
  let event;
  try {
    const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw ?? "{}");
    event = JSON.parse(text || "{}");
  } catch {
    return json(res, 400, { ok: false, error: "bad_json" });
  }

  const obj = (event && event.data && event.data.object) || {};
  const isSubEvent =
    event && SUB_EVENTS.includes(event.type) &&
    !(event.type === "checkout.session.completed" && obj.mode !== "subscription");
  if (isSubEvent) {
    try {
      const out = await handleSubscriptionEvent(event);
      return json(res, 200, {
        ok: true,
        version: WEBHOOK_HANDLER_VERSION,
        action: out.action,
        sub_id: out.sub_id || null,
      });
    } catch (e) {
      // 5xx so Stripe retries; the book is never half-written (atomic rename).
      return json(res, 500, { ok: false, error: String((e && e.message) || "subs_book_error") });
    }
  }

  const out = extractStripeSale(event);
  if (out.ignored) {
    await auditWebhookIgnored({ reason: out.reason, event_type: event && event.type });
    return json(res, 200, { ok: true, version: STRIPE_WEBHOOK_VERSION, ignored: true, reason: out.reason });
  }
  const { sale } = out;
  if (!sale.orderId) {
    await auditWebhookIgnored({ reason: "no_order_id", event_type: event && event.type });
    return json(res, 200, { ok: true, ignored: true, reason: "no_order_id" });
  }
  let duplicate = false;
  try {
    duplicate = await hasOrderId(sale.orderId);
  } catch {
    return json(res, 500, { ok: false, error: "ledger_unreadable" });
  }
  if (duplicate) {
    return json(res, 200, { ok: true, duplicate: true, order_id: sale.orderId });
  }
  const r = await recordSale(sale);
  if (!r.ok) return json(res, 500, { ok: false, error: "ledger_write_failed" });
  return json(res, 200, { ok: true, recorded: true, order_id: sale.orderId, sku: sale.sku });
}
