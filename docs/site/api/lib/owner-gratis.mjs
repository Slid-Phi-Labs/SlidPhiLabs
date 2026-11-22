/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Owner-gratis lane: the owner's human seat never pays.
 *
 * RULES (security fix 2026-11-22)
 * - An email address authenticates NOTHING. Anyone can type one into a
 *   request body, and HMAC claims carry whatever email the buyer typed, so
 *   "email inside a signed claim" is not proof of ownership either.
 * - Gratis is granted only by:
 *     1. isOwnerRequest(req): header `x-spl-owner-token` equals the
 *        SPL_OWNER_TOKEN secret (>= 32 chars, timing-safe compare), or
 *     2. an HMAC claim whose payload carries `owner: true`, which is only
 *        ever minted on lane 1 (see x402-products.js), or
 *     3. isOwnerAgent(agentId) where agentId comes from a VERIFIED Rider token.
 * - Gratis is always RECORDED (gratis:"owner" on claims/entitlements/records),
 *   never silent — the ledger must show what the owner took for free.
 * - Owner emails are configuration (SPL_OWNER_EMAILS, comma-separated) and
 *   are used only for labelling, never for authorization.
 */
import { timingSafeEqual } from "node:crypto";

export const OWNER_TOKEN_HEADER = "x-spl-owner-token";
export const OWNER_TOKEN_MIN_LEN = 32;

/** Owner emails from env (labelling only). Empty by default. */
export function ownerEmails(env = process.env) {
  return String((env && env.SPL_OWNER_EMAILS) || "")
    .split(",")
    .map((e) => normEmail(e))
    .filter(Boolean);
}

/** Back-compat export: resolved at import time from the environment. */
export const OWNER_EMAILS = ownerEmails();

/** Corey's human Rider seat (type human, operator corey). Lab worker seats
 *  are deliberately NOT here — workers stay metered so PSI keeps score.
 *  Only ever compared against an agent_id taken from a verified Rider token. */
export const OWNER_AGENT_IDS = ["2742251400a7dfcd"];

export function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/** Labelling only — NEVER use this to grant anything. */
export function isOwnerEmail(email, env = process.env) {
  const e = normEmail(email);
  return !!e && ownerEmails(env).includes(e);
}

export function isOwnerAgent(agentId) {
  return !!agentId && OWNER_AGENT_IDS.includes(String(agentId));
}

/** The configured owner token, or "" when unset/too short (lane disabled). */
export function ownerToken(env = process.env) {
  const t = String((env && env.SPL_OWNER_TOKEN) || "").trim();
  return t.length >= OWNER_TOKEN_MIN_LEN ? t : "";
}

/**
 * True only when the request presents the owner token. Fail-closed: no
 * configured token, a missing header or any mismatch → false.
 */
export function isOwnerRequest(req, env = process.env) {
  const want = ownerToken(env);
  if (!want) return false;
  const h = (req && req.headers) || {};
  const raw = h[OWNER_TOKEN_HEADER] ?? h["X-SPL-Owner-Token"];
  const got = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
  if (!got) return false;
  const a = Buffer.from(got, "utf8");
  const b = Buffer.from(want, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True only for a verified claim payload minted on the owner lane. */
export function isOwnerClaim(payload) {
  return !!payload && typeof payload === "object" && payload.owner === true;
}

/**
 * Resolve the owner lane for one request. Fail-closed envelopes throughout.
 * @param {object} [input] { ownerRequest?, claimPayload?, email? }
 *   ownerRequest must be the result of isOwnerRequest(req); claimPayload must
 *   come from verifyClaim(). `email` is accepted for backwards compatibility
 *   and IGNORED for authorization.
 */
export function resolveOwnerLane(input = {}) {
  const o = input && typeof input === "object" ? input : {};
  if (o.ownerRequest === true) return { ok: true, gratis: true, via: "owner-token" };
  if (isOwnerClaim(o.claimPayload)) return { ok: true, gratis: true, via: "owner-claim" };
  if (o.email || o.verifiedEmail) {
    return { ok: true, gratis: false, via: "none", ignored: "email-is-not-authentication" };
  }
  return { ok: true, gratis: false, via: "none" };
}
