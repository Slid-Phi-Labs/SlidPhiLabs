/**
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 * Byte counter for the hosted compressor.
 * Paid seats reset monthly. Everyone else draws a 1 GB lifetime allowance
 * keyed by IP (no monthly reset). Stored on the Fly volume (AUTH_DIR) so it survives restarts.
 *
 * Identity binding (anti-spoofing): the X-Forwarded-For / X-Real-IP header
 * is client-controlled, so the raw IP is NEVER used as a storage key or
 * filename. The IP identity is HMAC-SHA256(server_secret, "<day>|<ip>")
 * truncated to 32 hex chars, scoped to the current UTC day:
 *   key = `iph:<YYYY-MM-DD>:<hmac32>`
 * The raw IP never touches disk (no PII in usage filenames) and bucket
 * names are unguessable without the secret, so one tenant cannot read or
 * pollute another tenant's bucket by guessing filenames.
 *
 * Server secret: USAGE_IDENTITY_SECRET env. When unset, the fallback is a
 * deterministic per-process salt (`weak-process:<pid>:<ppid>`) — DOCUMENTED
 * WEAK: it is predictable to local observers and changes on every restart,
 * which rotates ALL IP buckets (quota state resets). Set
 * USAGE_IDENTITY_SECRET in production.
 *
 * Day-scoping means IP buckets are per-day: abuse of a bucket expires with
 * the day. Requests with no IP at all share a single low "anon" bucket
 * (ANON_INCLUDED_BYTES) so headerless abuse cannot draw the full free tier.
 */
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCookies } from "./spl-box-gate.js";
import { includedBytesForSku, FREE_GB, FREE_WINDOW, CENTS_PER_GB, computeQuote } from "../suite-pricing.js";
import { seatFromClaimHeader } from "./claim-seat.mjs";
import { isOwnerClaim, isOwnerRequest } from "./owner-gratis.mjs";

/** Owner quota: effectively unlimited, but usage is still COUNTED so the
 *  ledger shows what the owner took for free (gratis recorded, never silent). */
export const OWNER_INCLUDED_BYTES = Number.MAX_SAFE_INTEGER;

/** Shared headerless bucket: low on purpose (fail-closed for anon abuse). */
export const ANON_INCLUDED_BYTES = 10 * 1024 * 1024; // 10 MiB
export const ANON_KEY = "anon";
/** Prefix for HMAC-bound per-day IP identities. */
export const IPHM_PREFIX = "iph:";

/** Current UTC day `YYYY-MM-DD` (the rotation scope for IP identities). */
export function identityDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Where the identity secret comes from: "env" or the weak process fallback. */
export function identitySecretKind() {
  return process.env.USAGE_IDENTITY_SECRET ? "env" : "weak-process";
}

function identitySecretOf(opts = {}) {
  if (opts && typeof opts.secret === "string" && opts.secret.length > 0) return opts.secret;
  if (process.env.USAGE_IDENTITY_SECRET) return process.env.USAGE_IDENTITY_SECRET;
  // WEAK fallback (see header): predictable + restarts rotate every bucket.
  return `weak-process:${process.pid}:${process.ppid}`;
}

function hmac32(secret, text) {
  return createHmac("sha256", String(secret)).update(String(text), "utf8").digest("hex").slice(0, 32);
}

// Cloudflare publishes these ranges at https://www.cloudflare.com/ips-v4 and /ips-v6.
// Fly-Client-IP is the address that connected to the app. When that address is
// Cloudflare, CF-Connecting-IP is the visitor. A caller who hits fly.dev directly
// can send a forged CF-Connecting-IP, so that header is ignored unless the
// connection itself came from Cloudflare.
const CLOUDFLARE_V4 = [
  ["173.245.48.0", 20],
  ["103.21.244.0", 22],
  ["103.22.200.0", 22],
  ["103.31.4.0", 22],
  ["141.101.64.0", 18],
  ["108.162.192.0", 18],
  ["190.93.240.0", 20],
  ["188.114.96.0", 20],
  ["197.234.240.0", 22],
  ["198.41.128.0", 17],
  ["162.158.0.0", 15],
  ["104.16.0.0", 13],
  ["104.24.0.0", 14],
  ["172.64.0.0", 13],
  ["131.0.72.0", 22],
];
const CLOUDFLARE_V6 = [
  ["2400:cb00::", 32],
  ["2606:4700::", 32],
  ["2803:f800::", 32],
  ["2405:b500::", 32],
  ["2405:8100::", 32],
  ["2a06:98c0::", 29],
  ["2c0f:f248::", 32],
];

function firstIp(value) {
  const raw = String(value || "").split(",")[0].trim().toLowerCase();
  if (!raw || raw.length > 100) return null;
  return raw;
}

function ipv4ToInt(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = (n << 8n) + BigInt(octet);
  }
  return n;
}

function ipv6ToInt(ip) {
  const bare = ip.split("%")[0];
  if (bare.includes(".")) return null;
  const halves = bare.split("::");
  if (halves.length > 2) return null;
  let groups;
  if (halves.length === 1) {
    groups = bare.split(":");
  } else {
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    groups = [...left, ...Array(missing).fill("0"), ...right];
  }
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    n = (n << 16n) + BigInt(parseInt(group, 16));
  }
  return n;
}

function inCidr(ip, base, bits, v6) {
  const addr = v6 ? ipv6ToInt(ip) : ipv4ToInt(ip);
  const net = v6 ? ipv6ToInt(base) : ipv4ToInt(base);
  if (addr == null || net == null) return false;
  const width = v6 ? 128n : 32n;
  const shift = width - BigInt(bits);
  return addr >> shift === net >> shift;
}

function isCloudflareEdge(ip) {
  if (!ip) return false;
  if (ip.includes(":")) return CLOUDFLARE_V6.some(([base, bits]) => inCidr(ip, base, bits, true));
  return CLOUDFLARE_V4.some(([base, bits]) => inCidr(ip, base, bits, false));
}

/** Normalize a client address for hashing (never stored raw).
 * Trust order, combining the 2026-11-23 Cloudflare fix with the
 * 2026-11-22 anti-spoofing fix:
 *   1. CF-Connecting-IP, only with CF-Ray present and Fly-Client-IP
 *      inside a published Cloudflare range (a direct caller can forge it).
 *   2. Fly-Client-IP, set by Fly's edge over any client value.
 *   3. The LAST X-Forwarded-For entry, the hop our proxy appended.
 *      The first entry and X-Real-IP are client-controlled: never used.
 *   4. The socket peer address (local/dev). */
export function cleanIp(req) {
  const h = (req && req.headers) || {};
  const cf = firstIp(h["cf-connecting-ip"]);
  const fly = firstIp(h["fly-client-ip"]);
  if (cf && h["cf-ray"] && isCloudflareEdge(fly)) return cf;
  if (fly) return fly;
  const xff = String(Array.isArray(h["x-forwarded-for"]) ? h["x-forwarded-for"].join(",") : h["x-forwarded-for"] || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (xff.length) {
    const last = xff[xff.length - 1];
    return last.length <= 100 ? last : null;
  }
  const sock = String((req && req.socket && req.socket.remoteAddress) || "").trim().toLowerCase();
  if (!sock || sock.length > 100) return null;
  return sock;
}


export function ownerFromReq(req) {
  // Email inside a claim is whatever the buyer typed, so it proves nothing.
  // Only the owner token, or a claim minted on the owner-token lane, counts.
  if (isOwnerRequest(req)) return true;
  try {
    const s = seatFromClaimHeader(req);
    if (s.ok && isOwnerClaim(s.payload)) return true;
  } catch {
    /* fall through */
  }
  return false;
}

function rootDir() {
  const d = process.env.AUTH_DIR || "/data";
  try {
    if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
    return d;
  } catch {
    const fallback = join(tmpdir(), "spl-usage");
    if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true, mode: 0o700 });
    return fallback;
  }
}

export function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

/**
 * Identity for a request. opts (all optional, for tests):
 * { day: "YYYY-MM-DD", secret }.
 * - paid seat header  -> { key: `seat:<sku>:<id>`, via: "seat" }
 * - verifiable IP     -> { key: `iph:<day>:<hmac32>`, via: "box"|"ip" }
 * - no IP at all      -> { key: "anon", via: "anon" }
 */
export function identityFromReq(req, opts = {}) {
  const h = (req && req.headers) || {};
  const sku = String(h["x-spl-seat"] || h["x-spl-sku"] || "").toLowerCase();
  const id = String(h["x-spl-seat-id"] || "");
  if (sku && id) return { key: `seat:${sku}:${id}`, sku, via: "seat" };
  const box = parseCookies(req).spl_box || String(h["x-spl-box"] || "");
  const hasBox = String(box).length > 0;
  const ip = cleanIp(req);
  if (!ip) return { key: ANON_KEY, sku: "", via: "anon" };
  const day =
    opts && typeof opts.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opts.day)
      ? opts.day
      : identityDay(opts && opts.now instanceof Date ? opts.now : new Date());
  const tag = hmac32(identitySecretOf(opts), `${day}|${ip}`);
  return { key: `${IPHM_PREFIX}${day}:${tag}`, sku: "", via: hasBox ? "box" : "ip", day };
}

function pathFor(key, month) {
  const lifetime = !String(key).startsWith("seat:");
  const safe = lifetime
    ? String(key).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120)
    : String(key).replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
  const dir = join(rootDir(), "usage", lifetime ? "lifetime" : month);
  return { dir, file: join(dir, `${safe}.json`) };
}

export function readUsage(key, month = monthKey()) {
  const bucket = String(key).startsWith("seat:") ? month : "lifetime";
  const { file } = pathFor(key, bucket);
  if (!existsSync(file)) return { key, month: bucket, bytes: 0, jobs: 0, refusals: 0 };
  try {
    const j = JSON.parse(readFileSync(file, "utf8"));
    return { key, month: bucket, bytes: Number(j.bytes) || 0, jobs: Number(j.jobs) || 0, refusals: Number(j.refusals) || 0 };
  } catch {
    return { key, month: bucket, bytes: 0, jobs: 0, refusals: 0 };
  }
}

export function addUsage(key, n, month = monthKey()) {
  const add = Math.max(0, Number(n) || 0);
  const { dir, file } = pathFor(key, month);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cur = readUsage(key, month);
  const next = { key, month: cur.month, bytes: cur.bytes + add, jobs: cur.jobs + (add ? 1 : 0), refusals: cur.refusals };
  writeFileSync(file, JSON.stringify(next), { mode: 0o600 });
  return next;
}

/** Headerless-abuse job cap: requests per UTC day for the shared anon bucket.
 *  IP and paid identities are byte-capped (402 paywall), not job-capped. */
export const ANON_JOB_CAP = 20;

/** Record a refused request in the identity's bucket; returns the new count. */
export function recordRefusal(key, month = monthKey()) {
  const { dir, file } = pathFor(key, month);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cur = readUsage(key, month);
  const next = { key, month: cur.month, bytes: cur.bytes, jobs: cur.jobs, refusals: cur.refusals + 1 };
  writeFileSync(file, JSON.stringify(next), { mode: 0o600 });
  return next.refusals;
}

/**
 * Enforce the headerless-abuse job cap. Returns { allowed: true } or
 * { allowed: false, status: 429, body } with the refusal recorded in the
 * meter. IP and paid identities are byte-capped (402), never job-capped.
 */
export function quotaCheck(req) {
  const id = identityFromReq(req);
  if (id.key !== ANON_KEY) return { allowed: true, identity: id };
  const used = readUsage(id.key);
  if (used.jobs < ANON_JOB_CAP) return { allowed: true, identity: id };
  const refusals = recordRefusal(id.key);
  return {
    allowed: false,
    status: 429,
    body: {
      ok: false,
      error: "quota_exceeded",
      quota: "anon_jobs_per_day",
      job_cap: ANON_JOB_CAP,
      jobs: used.jobs,
      refusals,
      retry_after_s: 3600,
    },
  };
}

export function meterSnapshot(req, extraBytes = 0) {
  const id = identityFromReq(req);
  const used = readUsage(id.key);
  const owner = ownerFromReq(req);
  const included = owner
    ? OWNER_INCLUDED_BYTES
    : id.key === ANON_KEY
      ? ANON_INCLUDED_BYTES
      : includedBytesForSku(id.sku);
  const projected = used.bytes + Math.max(0, Number(extraBytes) || 0);
  const remaining = Math.max(0, included - used.bytes);
  const quote = computeQuote({ bytes: extraBytes, used_bytes: used.bytes, sku: id.sku });
  return {
    identity: owner ? "owner" : id.key.startsWith("seat:") ? "paid" : id.via === "box" ? "try" : "anon",
    sku: id.sku || null,
    month: used.month,
    window: id.key.startsWith("seat:") ? "calendar_month" : id.key === ANON_KEY ? FREE_WINDOW : "daily",
    used_bytes: used.bytes,
    jobs: used.jobs,
    refusals: used.refusals,
    job_cap: id.key === ANON_KEY ? ANON_JOB_CAP : null,
    included_bytes: included,
    remaining_bytes: remaining,
    remaining_gb: +(remaining / (1024 * 1024 * 1024)).toFixed(3),
    free_gb: FREE_GB,
    usd_per_gb: CENTS_PER_GB / 100,
    would_charge: extraBytes ? quote : null,
    over: projected > included,
  };
}

const PAY_LINKS = {
  gc_month: "https://www.slidphilabs.com/pay?sku=gc-month",
  gc_year: "https://www.slidphilabs.com/pay?sku=gc-year",
};

/**
 * Usage gate for every hosted compression route (encode AND decode).
 * Returns null when the call may proceed, else { status, body } carrying
 * the 429 quota or 402 paywall envelope.
 *
 * Every metered byte of INPUT counts, fill frames included: the book prices
 * input bytes, not the operation. Charging (addUsage) happens only on
 * success via recordMeteredBytes, so failed jobs never bill.
 */
export function usageGate(req, inputBytes) {
  const gate = quotaCheck(req);
  if (!gate.allowed) return { status: gate.status, body: gate.body };
  const bytes = Math.max(0, Number(inputBytes) || 0);
  const usage = meterSnapshot(req, bytes);
  if (usage.over && usage.would_charge && !usage.would_charge.free) {
    return {
      status: 402,
      body: {
        ok: false,
        error: "paywall",
        plain: usage.would_charge.plain,
        usage,
        buy: { ...PAY_LINKS },
      },
    };
  }
  return null;
}

export function recordMeteredBytes(req, n) {
  return addUsage(identityFromReq(req).key, n);
}
