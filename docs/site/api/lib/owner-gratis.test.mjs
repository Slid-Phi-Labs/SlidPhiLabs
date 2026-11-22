import test from "node:test";
import assert from "node:assert/strict";
import {
  OWNER_AGENT_IDS,
  normEmail,
  ownerEmails,
  isOwnerEmail,
  isOwnerAgent,
  isOwnerRequest,
  isOwnerClaim,
  ownerToken,
  resolveOwnerLane,
} from "./owner-gratis.mjs";

const ENV = { SPL_OWNER_EMAILS: " Owner@Example.com, second@example.com ", SPL_OWNER_TOKEN: "t".repeat(40) };

test("owner emails come from env and are labelling only", () => {
  assert.deepEqual(ownerEmails(ENV), ["owner@example.com", "second@example.com"]);
  assert.equal(isOwnerEmail("  OWNER@example.COM ", ENV), true);
  assert.equal(isOwnerEmail("stranger@example.com", ENV), false);
  assert.equal(isOwnerEmail("", ENV), false);
  assert.deepEqual(ownerEmails({}), [], "no hard-coded personal emails");
  assert.equal(normEmail("  A@B.C "), "a@b.c");
});

test("owner agents: human seat only, workers stay metered", () => {
  assert.equal(isOwnerAgent("2742251400a7dfcd"), true);
  for (const w of ["3b1a784af3ac017e", "e780957911ed8c38", "2d91c86704d7a057", "a8d146b5b2f78172", "5a53cc879ed19bdd", "09ccf71fdc6746e2", "e0eadbff05adda98"]) {
    assert.equal(isOwnerAgent(w), false);
  }
  assert.equal(isOwnerAgent(""), false);
  assert.equal(isOwnerAgent(null), false);
  assert.equal(OWNER_AGENT_IDS.length, 1);
});

test("owner token: exact match only, fail-closed when unset or short", () => {
  assert.equal(ownerToken(ENV), ENV.SPL_OWNER_TOKEN);
  assert.equal(ownerToken({ SPL_OWNER_TOKEN: "short" }), "");
  assert.equal(isOwnerRequest({ headers: { "x-spl-owner-token": ENV.SPL_OWNER_TOKEN } }, ENV), true);
  assert.equal(isOwnerRequest({ headers: { "x-spl-owner-token": ENV.SPL_OWNER_TOKEN + "x" } }, ENV), false);
  assert.equal(isOwnerRequest({ headers: {} }, ENV), false);
  assert.equal(isOwnerRequest({ headers: { "x-spl-owner-token": "" } }, {}), false);
  assert.equal(isOwnerRequest(null, ENV), false);
});

test("owner claims need the explicit owner flag", () => {
  assert.equal(isOwnerClaim({ owner: true }), true);
  assert.equal(isOwnerClaim({ owner: "true" }), false);
  assert.equal(isOwnerClaim({ email: "owner@example.com" }), false);
  assert.equal(isOwnerClaim(null), false);
});

test("resolveOwnerLane: token or owner claim only; emails never authenticate", () => {
  assert.deepEqual(resolveOwnerLane({ ownerRequest: true }), { ok: true, gratis: true, via: "owner-token" });
  assert.deepEqual(resolveOwnerLane({ claimPayload: { owner: true } }), { ok: true, gratis: true, via: "owner-claim" });
  assert.equal(resolveOwnerLane({ email: "owner@example.com" }).gratis, false);
  assert.equal(resolveOwnerLane({ verifiedEmail: "owner@example.com" }).gratis, false);
  assert.deepEqual(resolveOwnerLane(null), { ok: true, gratis: false, via: "none" });
});
