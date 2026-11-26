/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * AgentHQ name rules: `/[whatever]` resolves to a user-owned HQ dashboard.
 * Names are URL slugs claimed at creation (paid gate upstream); this module
 * only validates shape, never availability or payment.
 */

const RESERVED = new Set([
  "hq", "api", "www", "admin", "support", "billing", "status", "login",
  "join", "signup", "account", "welcome", "access", "healthz", "version",
  "mcp", "agents", "humans", "lab", "pay", "pps", "checkout", "pricing",
  "rider", "cuni", "tru8", "pcc", "chamber", "warrant", "docs", "blog",
  "wiki", "assets", "scripts", "styles", "hq-new", "new", "create",
]);

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/;

/** Normalize user input to a candidate slug (lowercase, trim slashes). */
export function normalizeSlug(input) {
  return String(input || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
}

/**
 * Validate a candidate HQ name. Returns { ok, slug?, reason? }.
 * Reasons: empty | bad_chars | reserved | too_short | too_long.
 */
export function validateSlug(input) {
  const slug = normalizeSlug(input);
  if (!slug) return { ok: false, reason: "empty" };
  if (slug.length < 3) return { ok: false, reason: "too_short" };
  if (slug.length > 30) return { ok: false, reason: "too_long" };
  if (!SLUG_RE.test(slug)) return { ok: false, reason: "bad_chars" };
  if (RESERVED.has(slug)) return { ok: false, reason: "reserved" };
  return { ok: true, slug };
}
