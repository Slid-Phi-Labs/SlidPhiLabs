/**
 * Unified agent payment gateway (402 auto-accept).
 *
 * One challenge, every configured rail. A paid call with no payment
 * gets a single 402 whose `accepts[]` lists each protocol this
 * deployment can actually settle:
 *
 *   x402  Solana USDC exact-price proof (existing solana-verify +
 *         global spent-tx ledger). Base x402 stays on /api/x402-suite
 *         and /api/x402-products, which already settle it.
 *   mpp   Stripe Machine Payments style SPT credential -> PaymentIntent
 *         capture. Only advertised when STRIPE_SECRET_KEY is set and
 *         GW_MPP_ENABLED=1 (Stripe program enrollment is operator-side).
 *   acp   Delegated payment token -> same Stripe capture path.
 *         Advertised when STRIPE_SECRET_KEY set and GW_ACP_ENABLED=1.
 *   ap2   Signed mandate (compact JWS, ES256/EdDSA) verified against
 *         AP2_ISSUER_PUBLIC_KEY. Advertised only when that key and
 *         GW_AP2_MERCHANT_ID are set.
 *
 * Guardrails, in order, before any settle runs:
 *   1. Policy: Rider identity (when a rider token is presented, or
 *      always when GW_REQUIRE_RIDER=1) and Warrant budget/action via
 *      the existing warrant.mjs verify + reserve.
 *   2. Replay: the challenge nonce is single-use (exclusive-create
 *      files on the Fly volume, same pattern as x402-spent-ledger),
 *      and x402 tx proofs go through the global spent ledger.
 *   3. Exact price: settled amount must equal the catalog price.
 *      Card rails also enforce GW_MIN_CARD_SETTLE_CENTS (default 50)
 *      so sub-threshold card captures are refused, not eaten by fees.
 *
 * Nothing fakes settlement: an unconfigured rail is not advertised,
 * and presenting one answers protocol_not_configured.
 */
import { existsSync, mkdirSync, openSync, closeSync, writeSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomBytes, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { PRODUCT_CATALOG, resolveSku, evmPayTo, solanaPayTo, USDC_BASE_MAINNET } from "./payments-rails.js";
import { consumePaymentTx } from "./x402-spent-ledger.mjs";
import { verifyReceipt, centsToRaw, SOLANA_USDC_MAINNET } from "./solana-verify.mjs";
import { verifyRiderToken, verifyWarrant, reserveWarrant, releaseReservation } from "./warrant.mjs";

export const GATEWAY_VERSION = "1.0.0";
const CHALLENGE_TTL_SEC = 600;

function rootDir(env = process.env) {
  const d = env.AUTH_DIR || (existsSync("/data") ? "/data" : null);
  if (d) {
    try {
      if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
      return d;
    } catch { /* fall through */ }
  }
  const fallback = join(tmpdir(), "spl-payment-gateway");
  if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true, mode: 0o700 });
  return fallback;
}

function nonceDir(env) {
  const d = join(rootDir(env), "gw-nonces");
  if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}

function nonceFile(env, nonce) {
  const digest = createHash("sha256").update(String(nonce)).digest("hex");
  return join(nonceDir(env), `${digest.slice(0, 32)}.json`);
}

/** Price for a SKU from the canonical catalog. Returns cents or null. */
export function priceForSku(rawSku) {
  const sku = resolveSku(rawSku);
  const entry = sku ? PRODUCT_CATALOG[sku] : null;
  if (!entry || !Number.isInteger(entry.amount_cents) || entry.amount_cents <= 0) return null;
  return { sku, amount_cents: entry.amount_cents, name: entry.name || sku };
}

/** Which protocols this deployment can settle right now. */
export function configuredProtocols(env = process.env) {
  const out = [];
  if (solanaPayTo(env)) out.push("x402");
  if (env.STRIPE_SECRET_KEY && env.GW_MPP_ENABLED === "1") out.push("mpp");
  if (env.STRIPE_SECRET_KEY && env.GW_ACP_ENABLED === "1") out.push("acp");
  if (env.AP2_ISSUER_PUBLIC_KEY && env.GW_AP2_MERCHANT_ID) out.push("ap2");
  return out;
}

function acceptsFor({ sku, amount_cents, nonce, env }) {
  const accepts = [];
  if (solanaPayTo(env)) {
    accepts.push({
      protocol: "x402",
      scheme: "exact",
      network: env.X402_NETWORK || "solana-mainnet-beta",
      asset: SOLANA_USDC_MAINNET,
      payTo: solanaPayTo(env),
      maxAmountRequired: centsToRaw(amount_cents),
      resource: `/api/payment-gateway?sku=${sku}`,
      mimeType: "application/json",
      extra: { nonce, amount_cents },
    });
  }
  if (env.STRIPE_SECRET_KEY && env.GW_MPP_ENABLED === "1") {
    accepts.push({ protocol: "mpp", provider: "stripe", currency: "usd", amount_cents, credential: "shared_payment_token (spt_)", nonce });
  }
  if (env.STRIPE_SECRET_KEY && env.GW_ACP_ENABLED === "1") {
    accepts.push({ protocol: "acp", provider: "stripe", currency: "usd", amount_cents, credential: "delegated_payment_token", nonce });
  }
  if (env.AP2_ISSUER_PUBLIC_KEY && env.GW_AP2_MERCHANT_ID) {
    accepts.push({ protocol: "ap2", merchant_id: env.GW_AP2_MERCHANT_ID, currency: "usd", amount_cents, mandate: "signed JWS (ES256|EdDSA)", nonce });
  }
  return accepts;
}

/** Issue a single-use 402 challenge. Stores the nonce digest on disk. */
export function issueChallenge({ sku, amount_cents, env = process.env }) {
  const nonce = randomBytes(16).toString("hex");
  const record = {
    schema: "spl.gateway.challenge.v1",
    sku,
    amount_cents,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SEC,
    at: new Date().toISOString(),
  };
  const fd = openSync(nonceFile(env, nonce), "wx", 0o600);
  try { writeSync(fd, JSON.stringify(record) + "\n"); } finally { closeSync(fd); }
  return {
    error: "payment_required",
    code: "payment_required",
    gateway: GATEWAY_VERSION,
    sku,
    amount_cents,
    currency: "usd",
    nonce,
    expires_at: new Date(record.exp * 1000).toISOString(),
    accepts: acceptsFor({ sku, amount_cents, nonce, env }),
  };
}

/**
 * Consume a challenge nonce exactly once and check it matches the
 * sku + exact price. A settle attempt burns the challenge either way,
 * so a failed payment cannot be retried under the same nonce.
 */
export function consumeChallenge({ nonce, sku, amount_cents, env = process.env }) {
  if (!nonce || typeof nonce !== "string") return { ok: false, reason: "missing_nonce" };
  const file = nonceFile(env, nonce);
  if (!existsSync(file)) return { ok: false, reason: "unknown_or_replayed_nonce" };
  let record;
  try { record = JSON.parse(readFileSync(file, "utf8")); } catch { return { ok: false, reason: "corrupt_challenge" }; }
  try { unlinkSync(file); } catch { /* consumed below regardless */ }
  if (Math.floor(Date.now() / 1000) > record.exp) return { ok: false, reason: "challenge_expired" };
  if (record.sku !== sku) return { ok: false, reason: "challenge_sku_mismatch" };
  if (record.amount_cents !== amount_cents) return { ok: false, reason: "challenge_amount_mismatch" };
  return { ok: true, record };
}

/** Which protocol a retry is speaking. Returns null when unrecognized. */
export function detectProtocol({ headers = {}, body = {} } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[String(k).toLowerCase()] = v;
  if (h["x-payment"] || (body && body.payload && body.payload.serializedTransaction)) return "x402";
  if (body && body.sku && (body.tx || body.signature)) return "x402";
  const cred = h["payment-credential"] || (body && body.payment_credential) || "";
  if (typeof cred === "string" && cred.startsWith("spt_")) return "mpp";
  if (body && body.protocol === "mpp") return "mpp";
  if (body && (body.delegated_token || body.protocol === "acp")) return "acp";
  if (body && (body.mandate || body.protocol === "ap2")) return "ap2";
  return null;
}

function headerVal(headers, name) {
  for (const [k, v] of Object.entries(headers || {})) if (String(k).toLowerCase() === name) return v;
  return null;
}

/**
 * Identity + policy gate. Rider: enforced when a token is presented
 * (x-rider-token) or GW_REQUIRE_RIDER=1. Warrant: enforced when an
 * X-Agent-Warrant is presented; reserves the exact USD amount so the
 * budget is held before settlement and released on failure.
 * Returns { ok, rider?, reservation? } or { ok: false, status, reason }.
 */
export async function checkPolicy({ req, amount_cents, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const headers = (req && req.headers) || {};
  const riderToken = headerVal(headers, "x-rider-token");
  let rider = null;
  if (riderToken || env.GW_REQUIRE_RIDER === "1") {
    const v = await verifyRiderToken(riderToken || "", { fetchImpl });
    if (!v.valid) return { ok: false, status: 403, reason: `rider_${v.reason || "invalid"}` };
    rider = v.rider;
  }
  const warrantToken = headerVal(headers, "x-agent-warrant");
  let reservation = null;
  if (warrantToken) {
    const usd = amount_cents / 100;
    const check = verifyWarrant(warrantToken, { action: "spend", usd });
    if (!check.ok) return { ok: false, status: 403, reason: `warrant_${check.reason || "invalid"}` };
    const r = reserveWarrant({ token: warrantToken, action: "spend", usd });
    if (!r.ok) return { ok: false, status: 403, reason: `warrant_${r.reason || "reserve_failed"}` };
    reservation = r.reservation;
  }
  return { ok: true, rider, reservation };
}

export function releasePolicy(reservation) {
  if (reservation && reservation.id) {
    try { releaseReservation(reservation.id); } catch { /* best effort */ }
  }
}

const CARD_FLOOR_DEFAULT = 50;
export function cardFloorCents(env = process.env) {
  const n = Number(env.GW_MIN_CARD_SETTLE_CENTS);
  return Number.isInteger(n) && n >= 0 ? n : CARD_FLOOR_DEFAULT;
}

function stripeForm(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) stripeForm(v, key, out);
    else if (v !== undefined && v !== null) out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out;
}

/**
 * Shared Stripe capture for the card rails (mpp SPT, acp delegated
 * token). Exact amount by construction; refuses below the card floor.
 * Adapters: { fetchImpl } for tests.
 */
export async function settleStripeRail({ protocol, credential, sku, amount_cents, nonce, env = process.env, fetchImpl = globalThis.fetch }) {
  if (!env.STRIPE_SECRET_KEY) return { ok: false, reason: "protocol_not_configured" };
  if (protocol === "mpp" && env.GW_MPP_ENABLED !== "1") return { ok: false, reason: "protocol_not_configured" };
  if (protocol === "acp" && env.GW_ACP_ENABLED !== "1") return { ok: false, reason: "protocol_not_configured" };
  if (amount_cents < cardFloorCents(env)) return { ok: false, reason: "below_min_settlement", floor_cents: cardFloorCents(env) };
  if (typeof credential !== "string" || !/^(spt_|pm_|tok_)/.test(credential)) {
    return { ok: false, reason: "bad_credential" };
  }
  const body = stripeForm({
    amount: amount_cents,
    currency: "usd",
    payment_method: credential,
    confirm: true,
    off_session: true,
    description: `L33t gateway ${protocol} ${sku}`,
    metadata: { protocol, sku, nonce },
  }).join("&");
  let res, data;
  try {
    res = await fetchImpl("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    return { ok: false, reason: "stripe_unreachable", detail: String((e && e.message) || e) };
  }
  if (!res.ok || !data || data.status !== "succeeded") {
    return { ok: false, reason: (data && data.last_payment_error && data.last_payment_error.code) || "stripe_not_succeeded", detail: data && data.status };
  }
  if (data.amount !== amount_cents && data.amount_received !== amount_cents) {
    return { ok: false, reason: "amount_mismatch", detail: data.amount_received };
  }
  return { ok: true, settled_id: data.id, amount_cents };
}

/** x402 Solana exact-price settle, replay-safe via the spent ledger. */
export async function settleX402({ signature, sku, amount_cents, env = process.env, adapters = {} }) {
  if (!solanaPayTo(env)) return { ok: false, reason: "protocol_not_configured" };
  const v = await verifyReceipt(
    {
      signature,
      expected: { amount_cents, mint: SOLANA_USDC_MAINNET, destination: solanaPayTo(env) },
    },
    adapters
  );
  if (!v.ok) return { ok: false, reason: v.error || "x402_verify_failed", detail: v.detail };
  const spent = consumePaymentTx(signature, { endpoint: "/api/payment-gateway", sku, network: "solana" });
  if (!spent.ok) return { ok: false, reason: "already_used" };
  return { ok: true, settled_id: signature, amount_cents };
}

function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

/**
 * AP2 mandate settle. Mandate is a compact JWS (ES256 or EdDSA)
 * signed by the configured issuer key. Claims checked: merchant,
 * currency, expiry, amount cap >= exact price, nonce == challenge.
 * The settled amount is always the catalog price, never the cap.
 */
export function settleAp2({ mandate, sku, amount_cents, nonce, env = process.env }) {
  if (!env.AP2_ISSUER_PUBLIC_KEY || !env.GW_AP2_MERCHANT_ID) return { ok: false, reason: "protocol_not_configured" };
  if (typeof mandate !== "string") return { ok: false, reason: "bad_mandate" };
  const parts = mandate.split(".");
  if (parts.length !== 3) return { ok: false, reason: "bad_mandate" };
  let header, claims, key;
  try {
    header = b64urlJson(parts[0]);
    claims = b64urlJson(parts[1]);
    key = createPublicKey(env.AP2_ISSUER_PUBLIC_KEY);
  } catch { return { ok: false, reason: "bad_mandate" }; }
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = Buffer.from(parts[2], "base64url");
  let valid = false;
  try {
    if (header.alg === "EdDSA") valid = cryptoVerify(null, signed, key, sig);
    else if (header.alg === "ES256") valid = cryptoVerify("sha256", signed, { key, dsaEncoding: "ieee-p1363" }, sig);
  } catch { valid = false; }
  if (!valid) return { ok: false, reason: "mandate_signature_invalid" };
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && now > claims.exp) return { ok: false, reason: "mandate_expired" };
  if (claims.merchant_id !== env.GW_AP2_MERCHANT_ID) return { ok: false, reason: "mandate_merchant_mismatch" };
  if (claims.currency && claims.currency !== "usd") return { ok: false, reason: "mandate_currency_mismatch" };
  if (claims.nonce !== nonce) return { ok: false, reason: "mandate_nonce_mismatch" };
  const cap = Number(claims.amount_cents);
  if (!Number.isInteger(cap) || cap < amount_cents) return { ok: false, reason: "mandate_below_price" };
  if (claims.sku && claims.sku !== sku) return { ok: false, reason: "mandate_sku_mismatch" };
  return { ok: true, settled_id: claims.jti || claims.payment_mandate_id || "ap2-mandate", amount_cents };
}

export function gatewayReceipt({ protocol, sku, amount_cents, settled_id, nonce }) {
  const id = "gw_" + createHash("sha256").update(`${nonce}|${protocol}|${settled_id}`).digest("hex").slice(0, 24);
  return {
    receipt_id: id,
    schema: "spl.gateway.receipt.v1",
    protocol,
    sku,
    amount_cents,
    currency: "usd",
    settled_id,
    at: new Date().toISOString(),
  };
}

