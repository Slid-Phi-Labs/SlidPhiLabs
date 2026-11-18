/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Hosted encode job entry: meter-then-encode wrapper around specialist encode.
 * Pure glue over injectable lib helpers; no network. Fail-closed envelopes.
 */
import { encodeHosted, MAX_RAW } from "./specialist.mjs";
import { meterSnapshot, usageGate, recordMeteredBytes } from "./usage-meter.mjs";

export async function runHostedEncode(req, raw) {
  if (!raw || !raw.length) return { status: 400, body: { ok: false, error: "empty_body" } };
  if (raw.length > MAX_RAW) {
    return { status: 413, body: { ok: false, error: "too_large", max_raw: MAX_RAW } };
  }
  const blocked = usageGate(req, raw.length);
  if (blocked) return { status: blocked.status, body: blocked.body };
  const out = await encodeHosted(raw);
  recordMeteredBytes(req, raw.length);
  return { status: 200, body: { ...out, usage: meterSnapshot(req) } };
}
