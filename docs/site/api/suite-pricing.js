/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Suite free edge (canonical): unpaid 6.9 GB / 3 h, then $0.05/GB,
 * bulk $0.04/GB after 100 paid GB, min $0.05. Time window enforced on
 * the host; this quote is bytes-only.
 * Pro plan $25/month includes 100 GB, then $0.20/GB.
 * Customer-set monthly spend cap (default $25 pay-as-you-go), alert at
 * 80% of the cap and of the included allowance.
 * No op-differentiated tiers: the meter prices input bytes, not the
 * operation. Lab Pass carries NO included GB (compression is out of the
 * bundle); retired gc-* SKUs fall back to the unpaid free cap.
 */
export const FREE_GB = 6.9;
export const FREE_WINDOW_HOURS = 3;
export const FREE_BYTES = Math.round(FREE_GB * 1024 * 1024 * 1024);
export const FREE_WINDOW = "3h";
export const CENTS_PER_GB = 5;
export const BULK_CENTS_PER_GB = 4;
export const BULK_AFTER_PAID_GB = 100;
export const PRO_CENTS_PER_GB = 20;
export const PRO_INCLUDED_GB = 100;
export const MIN_PAID_CENTS = 5;
export const MAX_BYTES = 1024 * 1024 * 1024 * 1024;
export const MAX_CENTS = 1_000_000;
export const DEFAULT_CAP_CENTS = 2500;
export const ALERT_FRACTION = 0.8;

/** Included GB by plan SKU. Pro seats reset monthly; the free cap is lifetime-per-IP. Lab Pass and retired SKUs: free cap only. */
export const INCLUDED_GB = Object.freeze({
  "": FREE_GB,
  env: FREE_GB,
  "pcc-pro": PRO_INCLUDED_GB,
  "pcc-pro-year": PRO_INCLUDED_GB,
  suite: FREE_GB,
});

export function includedBytesForSku(sku) {
  const k = String(sku || "").toLowerCase();
  const gb = INCLUDED_GB[k] != null ? INCLUDED_GB[k] : FREE_GB;
  return Math.round(gb * 1024 * 1024 * 1024);
}

export function rateCentsPerGbForSku(sku) {
  const k = String(sku || "").toLowerCase();
  if (k === "pcc-pro" || k === "pcc-pro-year") return PRO_CENTS_PER_GB;
  return CENTS_PER_GB;
}

export function usageFeeCents(billableBytes, sku = "") {
  const b = Math.max(0, Number(billableBytes) || 0);
  if (b <= 0) return 0;
  const gb = b / (1024 * 1024 * 1024);
  const k = String(sku || "").toLowerCase();
  if (k === "pcc-pro" || k === "pcc-pro-year") {
    return Math.round(gb * PRO_CENTS_PER_GB);
  }
  if (gb <= BULK_AFTER_PAID_GB) return Math.round(gb * CENTS_PER_GB);
  return Math.round(
    BULK_AFTER_PAID_GB * CENTS_PER_GB + (gb - BULK_AFTER_PAID_GB) * BULK_CENTS_PER_GB,
  );
}

/** Cap/alert status for a metered spend. Alert fires at 80% of the cap. */
export function capStatus({ spent_cents = 0, cap_cents = DEFAULT_CAP_CENTS } = {}) {
  const spent = Math.max(0, Number(spent_cents) || 0);
  const cap = Math.max(0, Number(cap_cents) || 0);
  const fraction = cap > 0 ? spent / cap : 0;
  return {
    spent_cents: spent,
    cap_cents: cap,
    fraction,
    alert: fraction >= ALERT_FRACTION,
    alert_at_cents: Math.round(cap * ALERT_FRACTION),
    remaining_cents: Math.max(0, cap - spent),
  };
}

export function computeQuote({
  product = "auto",
  dataClass = "unknown",
  op = "compress",
  bytes = 0,
  used_bytes = 0,
  sku = "",
} = {}) {
  const b = Math.max(0, Math.min(Number(bytes) || 0, MAX_BYTES));
  const used = Math.max(0, Number(used_bytes) || 0);
  const operation = typeof op === "string" && op ? op : "compress";
  const included = includedBytesForSku(sku);
  const rate = rateCentsPerGbForSku(sku);
  const free_left = Math.max(0, included - used);
  const billable = Math.max(0, b - free_left);
  const free = billable <= 0;
  const rates = {
    free_cap_gb: FREE_GB,
    free_window_hours: FREE_WINDOW_HOURS,
    included_gb: included / (1024 * 1024 * 1024),
    usd_per_gb: CENTS_PER_GB / 100,
    usd_per_gb_bulk: BULK_CENTS_PER_GB / 100,
    pro_usd_per_gb: PRO_CENTS_PER_GB / 100,
    applied_usd_per_gb: rate / 100,
    min_paid_usd: MIN_PAID_CENTS / 100,
    window: FREE_WINDOW,
    cap_default_cents: DEFAULT_CAP_CENTS,
    alert_fraction: ALERT_FRACTION,
    alert_at_cents: Math.round(DEFAULT_CAP_CENTS * ALERT_FRACTION),
  };
  const plain_free = `Unpaid cap ${FREE_GB} GB / ${FREE_WINDOW_HOURS} h. Then $${(CENTS_PER_GB / 100).toFixed(2)}/GB (bulk $${(BULK_CENTS_PER_GB / 100).toFixed(2)}/GB after ${BULK_AFTER_PAID_GB} paid GB). Min $${(MIN_PAID_CENTS / 100).toFixed(2)}. Pro plan: 100 GB included, then $${(PRO_CENTS_PER_GB / 100).toFixed(2)}/GB.`;
  if (free) {
    return {
      ok: true,
      service: "SPL Pay Per Suite",
      plain: plain_free,
      currency: "usd",
      amount_cents: 0,
      amount_display: "0.00",
      free: true,
      tier: "unpaid_cap",
      message: plain_free,
      breakdown: {
        product,
        op: operation,
        data_class: dataClass,
        bytes: b,
        used_bytes: used,
        free_left,
        billable_bytes: 0,
        usage_cents: 0,
        rates,
        sku: sku || null,
      },
    };
  }
  const usage = usageFeeCents(billable, sku);
  const cents = Math.min(MAX_CENTS, Math.max(MIN_PAID_CENTS, usage));
  return {
    ok: true,
    service: "SPL Pay Per Suite",
    plain: `${plain_free} This job: $${(cents / 100).toFixed(2)}.`,
    currency: "usd",
    amount_cents: cents,
    amount_display: (cents / 100).toFixed(2),
    free: false,
    tier: "usage",
    message: `Over unpaid ${FREE_GB} GB / ${FREE_WINDOW_HOURS} h — $${(CENTS_PER_GB / 100).toFixed(2)}/GB (bulk $${(BULK_CENTS_PER_GB / 100).toFixed(2)}/GB), min $${(MIN_PAID_CENTS / 100).toFixed(2)}.`,
    breakdown: {
      product,
      op: operation,
      data_class: dataClass,
      bytes: b,
      used_bytes: used,
      free_left,
      billable_bytes: billable,
      usage_cents: usage,
      rates,
      sku: sku || null,
    },
  };
}

export const PRICING_EXAMPLES = [
  { gb: 6.9, label: "6.9 GB", approx: "$0 (under unpaid 6.9 GB / 3 h)" },
  { gb: 10, label: "10 GB", approx: "$0.16 (3.1 GB over × 5¢; min $0.05)" },
  { gb: 20, label: "20 GB on Pro", approx: "$0 (under 100 GB included)" },
  { gb: 120, label: "120 GB on Pro", approx: "$4.00 (20 GB over at 20¢)" },
];
