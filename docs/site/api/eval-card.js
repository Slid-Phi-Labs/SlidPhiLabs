/**
 * POST /api/eval-card — vendor eval card (BenchHaus FIRST suites).
 * Runs the offline self-graded suites against a caller-supplied spec
 * (or defaults) and returns the digest-verified receipt plus quote.
 * Box trial door for browsers; usage-metered on spec bytes otherwise.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 */
import { withProductBox } from "./lib/spl-box-gate.js";
import { usageGate, recordMeteredBytes } from "./lib/usage-meter.mjs";
import { runBenchhaus, BENCHHAUS_VERSION } from "./lib/benchhaus.mjs";

const MAX_SPEC_BYTES = 64 * 1024;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      product: "eval-card",
      engine: "benchhaus",
      engineVersion: BENCHHAUS_VERSION,
      how: "POST { benchhaus?: {...overrides} } — offline FIRST suites, digest-verified receipt",
      pair: "GET /api/bench (live numbers) · /standings (records)",
    });
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }
  let spec = req.body;
  if (typeof spec === "string") {
    try {
      spec = JSON.parse(spec);
    } catch {
      return json(res, 400, { ok: false, error: "Invalid JSON" });
    }
  }
  if (spec == null) spec = {};
  if (typeof spec !== "object" || Buffer.isBuffer(spec)) {
    return json(res, 400, { ok: false, error: "object_spec_required" });
  }
  const specBytes = Buffer.byteLength(JSON.stringify(spec));
  if (specBytes > MAX_SPEC_BYTES) {
    return json(res, 413, { ok: false, error: "spec_too_large", max_bytes: MAX_SPEC_BYTES });
  }
  const blocked = usageGate(req, specBytes);
  if (blocked) return json(res, blocked.status, blocked.body);
  let card;
  try {
    card = runBenchhaus(spec);
  } catch (e) {
    return json(res, 500, { ok: false, error: "eval_failed", detail: String((e && e.message) || e).slice(0, 200) });
  }
  if (!card || card.ok !== true) {
    return json(res, 422, { ok: false, error: (card && (card.reason || card.error)) || "eval_refused", card });
  }
  recordMeteredBytes(req, specBytes);
  return json(res, 200, { ok: true, card });
}

export default withProductBox(handler, "eval");
