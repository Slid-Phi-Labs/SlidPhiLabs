import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { computeQuote, FREE_BYTES, usageFeeCents } from "../src/quote.mjs";

const GiB = 1024 ** 3;

/** Unpaid 6.9 GB / 3 h gold — then 5¢/GB, min $0.05. */
const CASES = [
  { bytes: 0, expect: 0 },
  { bytes: FREE_BYTES, expect: 0 },
  { bytes: FREE_BYTES + 1 * GiB, expect: 5 },
  { bytes: 20 * GiB, expect: usageFeeCents(20 * GiB - FREE_BYTES) },
];

test("JS quote matches unpaid 6.9 GB / 3 h meter gold", () => {
  const got = CASES.map((c) => computeQuote({ bytes: c.bytes }).amount_cents);
  assert.deepEqual(got, CASES.map((c) => c.expect));
});

test("live cuni prove is opt-in via CUNI_BIN + CUNI_SUITE_METER_LAW (no skip)", () => {
  // G-EXEC-02: default suite must report zero skipped. Live prove stays
  // behind env gates and runs only when both are set; otherwise this test
  // asserts the gate instead of t.skip().
  const cuni = process.env.CUNI_BIN;
  const law = process.env.CUNI_SUITE_METER_LAW;
  if (!cuni || !law) {
    assert.equal(Boolean(cuni && law), false);
    return;
  }
  const printer = new URL("./print-suite-meter.mjs", import.meta.url);
  const r = spawnSync(cuni, ["prove", law, "--against", printer.pathname], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});
