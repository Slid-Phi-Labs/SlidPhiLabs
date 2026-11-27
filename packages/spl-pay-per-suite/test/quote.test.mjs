import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeQuote,
  classifyBytes,
  usageFeeCents,
  capStatus,
  includedBytesForSku,
  rateCentsPerGbForSku,
  FREE_BYTES,
  FREE_GB,
  FREE_WINDOW_HOURS,
  CENTS_PER_GB,
  BULK_CENTS_PER_GB,
  PRO_CENTS_PER_GB,
  MIN_PAID_CENTS,
  DEFAULT_CAP_CENTS,
  ALERT_FRACTION,
  SUITE_PRICING,
} from "../src/quote.mjs";
const GiB = 1024 ** 3;

test("1 GB lifetime free edge is free", () => {
  const q = computeQuote({ bytes: FREE_BYTES, product: "auto" });
  assert.equal(q.amount_cents, 0);
  assert.equal(q.free, true);
});

test("just over unpaid cap bills at 5¢/GB with $0.05 min", () => {
  const q = computeQuote({ bytes: FREE_BYTES + 1 * GiB, product: "auto" });
  assert.equal(q.free, false);
  assert.equal(q.breakdown.usage_cents, 5, "1 GB over × 5¢ = 5");
  assert.equal(q.amount_cents, 5, "$0.05 min");
  assert.equal(q.breakdown.rates.usd_per_gb, 0.05);
});

test("FREE_BYTES is the 1 GB lifetime free edge", () => {
  assert.equal(FREE_GB, 1);
  assert.equal(FREE_WINDOW_HOURS, null);
  assert.equal(FREE_BYTES, Math.round(1 * GiB));
  assert.equal(computeQuote({ bytes: FREE_BYTES }).amount_cents, 0);
});

test("20 GB bills unpaid overage at 5¢/GB", () => {
  const q = computeQuote({ bytes: 20 * GiB, product: "auto" });
  const billable = 20 * GiB - FREE_BYTES;
  const expect = usageFeeCents(billable);
  assert.equal(q.free, false);
  assert.equal(q.breakdown.usage_cents, expect);
  assert.equal(q.amount_cents, expect);
});

test("usageFeeCents prices unpaid at 5¢ then 4¢ bulk", () => {
  assert.equal(usageFeeCents(0), 0);
  assert.equal(usageFeeCents(1 * GiB), 5);
  assert.equal(CENTS_PER_GB, 5);
  assert.equal(BULK_CENTS_PER_GB, 4);
  assert.equal(PRO_CENTS_PER_GB, 20);
  assert.equal(usageFeeCents(150 * GiB), 100 * 5 + 50 * 4);
});

test("op does not change the price (single input rate)", () => {
  const c = computeQuote({ bytes: 40 * GiB, op: "compress" }).amount_cents;
  const d = computeQuote({ bytes: 40 * GiB, op: "decompress" }).amount_cents;
  const r = computeQuote({ bytes: 40 * GiB, op: "roundtrip" }).amount_cents;
  const expect = usageFeeCents(40 * GiB - FREE_BYTES);
  assert.equal(c, d);
  assert.equal(d, r);
  assert.equal(c, expect);
});

test("unknown op keeps the same price", () => {
  const q = computeQuote({ bytes: 20 * GiB, op: "bogus" });
  assert.equal(q.amount_cents, usageFeeCents(20 * GiB - FREE_BYTES));
});

test("Pro SKU includes 100 GB, then 20¢/GB", () => {
  const under = computeQuote({ bytes: 10 * GiB, sku: "pcc-pro" });
  assert.equal(under.free, true);
  const over = computeQuote({ bytes: 120 * GiB, sku: "pcc-pro" });
  assert.equal(over.breakdown.usage_cents, 400, "20 GB over at 20¢ = 400");
  assert.equal(over.amount_cents, 400);
  assert.equal(rateCentsPerGbForSku("pcc-pro-year"), 20);
  assert.equal(includedBytesForSku("pcc-pro-year"), 100 * GiB);
});

test("lab-pass and retired gc-year fall back to the unpaid free cap", () => {
  assert.equal(includedBytesForSku("lab-pass"), FREE_BYTES);
  assert.equal(includedBytesForSku("gc-year"), FREE_BYTES);
  const q = computeQuote({ bytes: 10 * GiB, sku: "lab-pass" });
  assert.equal(q.free, false);
  assert.equal(q.breakdown.usage_cents, usageFeeCents(10 * GiB - FREE_BYTES));
});

test("min paid is $0.05 with $25 default cap and 80% alert", () => {
  assert.equal(MIN_PAID_CENTS, 5);
  assert.equal(DEFAULT_CAP_CENTS, 2500);
  assert.equal(ALERT_FRACTION, 0.8);
  const cap = capStatus({ spent_cents: 2000 });
  assert.equal(cap.alert, true);
  assert.equal(cap.alert_at_cents, 2000);
  assert.equal(cap.remaining_cents, 500);
});

test("SUITE_PRICING is the 1 GB free once per address (lifetime) model", () => {
  assert.equal(SUITE_PRICING.model, "free_1gb_lifetime");
  assert.equal(SUITE_PRICING.free_cap_gb, 1);
  assert.equal(SUITE_PRICING.usd_per_gb_after_free, 0.05);
  assert.equal(SUITE_PRICING.usd_per_gb_bulk, 0.04);
  assert.equal(SUITE_PRICING.window, "lifetime-per-address");
});

test("used_bytes consumes the unpaid allowance", () => {
  const q = computeQuote({ bytes: 1 * GiB, used_bytes: FREE_BYTES });
  assert.equal(q.free, false);
  assert.equal(q.amount_cents, 5, "1 GB over is 5¢");
});

test("classify zeros", () => {
  assert.equal(classifyBytes(Buffer.alloc(64)).dataClass, "zeros");
});

test("invalid inputs fall back instead of charging", () => {
  assert.equal(computeQuote({ bytes: -5 }).amount_cents, 0);
  assert.equal(computeQuote({ bytes: -5 }).free, true);
  assert.equal(computeQuote({ bytes: Number.NaN }).amount_cents, 0);
  const bogus = computeQuote({ bytes: FREE_BYTES + 1 * GiB, product: "bogus-product" });
  const auto = computeQuote({ bytes: FREE_BYTES + 1 * GiB, product: "auto" });
  assert.equal(bogus.amount_cents, auto.amount_cents);
});
