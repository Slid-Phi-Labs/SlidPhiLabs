/** Fold-mode (0.3.0) tests: empty-start PERsiST-style folding alongside the
 *  unchanged extractive default. Offline, deterministic, no network. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  compressContext, compressContextAsync, verifyCompression, foldSkeleton,
  parseContextMode, parseFoldBudget, CONTEXT_VERSION,
  DEFAULT_FOLD_BUDGET_TOKENS, EXTRACTIVE_MODE, FOLD_MODE,
} from "./context-compress.mjs";
import { dispatchAgentic } from "./agentic-platform.mjs";

const PARA = String.fromCharCode(10, 10);
const DOC = [
  "import { encodeHosted } from './specialist.mjs';\nimport { meterSnapshot } from './usage-meter.mjs';\nexport async function runHostedEncode(req, raw) {\n  const out = await encodeHosted(raw);\n  return { status: 200, body: out };\n}",
  'Gardening tips for spring tulips.\nSoil rotation schedules for county fairs.\nFarmers markets open at dawn on Saturdays.\nCompost heaps need turning every fortnight.',
  'export function usageGate(req, inputBytes) {\n  // meter every input byte against allowance\n  const blocked = checkQuota(req, inputBytes);\n  if (blocked) return blocked;\n  return recordMeteredBytes(req, inputBytes);\n}',
  'Weather today is sunny.\nScattered clouds drift over the hills.\nValleys stay cool until noon.',
].join(PARA);
const Q = 'how does runHostedEncode meter usage bytes';
const OPTS = { maxTokens: 40, reranker: 'none' };

test("version 0.3.0", () => assert.equal(CONTEXT_VERSION, "0.3.0"));

test("fold packs skeletons under budget, drops the rest with reasons", () => {
  const r = compressContext({ text: DOC, query: Q, mode: "fold", foldBudget: 50, ...OPTS });
  assert.equal(r.ok, true);
  assert.equal(r.refused, false);
  assert.equal(r.mode, "fold");
  assert.equal(r.foldBudget, 50);
  assert.ok(r.outTokens <= 50, `over budget: ${r.outTokens}`);
  assert.ok(r.kept.length >= 1);
  assert.ok(r.kept.every((k) => k.folded === true && typeof k.orig_tokens === "number"));
  assert.ok(r.dropped.length >= 1);
  assert.ok(r.dropped.every((d) => ["over_fold_budget", "fold_empty"].includes(d.reason)));
  const v = verifyCompression({ input: DOC, output: r.output, query: Q });
  assert.equal(v.ok, true);
});

test("fold keeps everything when the budget fits", () => {
  const r = compressContext({ text: DOC, query: Q, mode: "fold", foldBudget: 500, ...OPTS });
  assert.equal(r.dropped.length, 0);
  assert.ok(r.kept.length >= 3);
});

test("first chunk is always kept (progress guarantee, mirrors extractive)", () => {
  const r = compressContext({ text: DOC, query: Q, mode: "fold", foldBudget: 5, ...OPTS });
  assert.ok(r.kept.length >= 1);
});

test("fold digest is stable", () => {
  const a = compressContext({ text: DOC, query: Q, mode: "fold", foldBudget: 50, ...OPTS });
  const b = compressContext({ text: DOC, query: Q, mode: "fold", foldBudget: 50, ...OPTS });
  assert.equal(a.digest, b.digest);
  assert.equal(a.output, b.output);
});

test("extractive default unchanged: no mode field", () => {
  const r = compressContext({ text: DOC, query: Q, ...OPTS });
  assert.equal(r.ok, true);
  assert.ok(!("mode" in r));
  assert.ok(r.outTokens > 0);
});

test("unknown mode fails closed", () => {
  const r = compressContext({ text: DOC, query: Q, mode: "fodl", ...OPTS });
  assert.equal(r.ok, false);
  assert.equal(r.error, "unknown_mode");
});

test("irrelevant query refused in fold mode", () => {
  const r = compressContext({ text: DOC, query: "zebra xylophone quantum", mode: "fold", ...OPTS });
  assert.equal(r.ok, true);
  assert.equal(r.refused, true);
  assert.equal(r.reason, "no_relevant_chunks");
});

test("empty input refused in fold mode", () => {
  const r = compressContext({ text: "   ", query: Q, mode: "fold", ...OPTS });
  assert.equal(r.refused, true);
  assert.equal(r.reason, "empty_input");
});

test("bad fold budget falls back to default", () => {
  const r = compressContext({ text: DOC, query: Q, mode: "fold", foldBudget: 0, ...OPTS });
  assert.equal(r.foldBudget, DEFAULT_FOLD_BUDGET_TOKENS);
  assert.ok(r.outTokens <= DEFAULT_FOLD_BUDGET_TOKENS);
});

test("async parity", async () => {
  const r = await compressContextAsync({ text: DOC, query: Q, mode: "fold", foldBudget: 50, ...OPTS });
  assert.equal(r.ok, true);
  assert.equal(r.mode, "fold");
  assert.ok(r.outTokens <= 50);
});

test("parse helpers", () => {
  assert.equal(parseContextMode("FOLD"), "fold");
  assert.equal(parseContextMode(""), "extractive");
  assert.equal(parseContextMode("nope"), null);
  assert.equal(parseFoldBudget("x"), DEFAULT_FOLD_BUDGET_TOKENS);
  assert.equal(parseFoldBudget(120), 120);
  assert.equal(FOLD_MODE, "fold");
  assert.equal(EXTRACTIVE_MODE, "extractive");
});

test("foldSkeleton keeps structure + query lines, drops prose", () => {
  const prose = 'Gardening tips for spring tulips.\nSoil rotation schedules for county fairs.';
  const out = foldSkeleton(prose, new Set(['usage', 'bytes']));
  assert.ok(out.includes('Gardening tips'));
  assert.ok(!out.includes('Soil rotation'));
  const code = 'export function usageGate(req, inputBytes) {\n  const blocked = checkQuota(req);\n  if (blocked) return blocked;\n}';
  const sk = foldSkeleton(code, new Set(['other']));
  assert.ok(sk.includes('export function usageGate'));
  assert.ok(sk.includes('if (blocked) return blocked;'));
});

test("dispatch spl_agentic_context threads fold mode", async () => {
  const r = await dispatchAgentic("spl_agentic_context", {
    text: DOC, query: Q, mode: "fold", foldBudget: 60, reranker: "none",
  });
  assert.equal(r.ok, true);
  assert.equal(r.mode, "fold");
  assert.equal(r.toolVersion, "0.3.0");
  assert.ok(r.quote);
});
