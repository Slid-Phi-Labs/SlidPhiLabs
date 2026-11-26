import { test } from "node:test";
import assert from "node:assert/strict";
import { issueIdentity, verifyIdentity } from "../../../identity/ed25519.mjs";

test("rider api package can issue an identity", () => {
  assert.equal(verifyIdentity(issueIdentity({ agent_id: "rider-api" })).ok, true);
});

test("tampered and expired identities are refused", () => {
  const good = issueIdentity({ agent_id: "rider-api" });
  const tampered = { ...good, sig: good.sig.slice(0, -2) + "AA" };
  assert.equal(verifyIdentity(tampered).reason, "bad_signature");
  const stale = issueIdentity({ agent_id: "rider-api", ttl_seconds: -10 });
  assert.equal(verifyIdentity(stale).reason, "expired");
});
