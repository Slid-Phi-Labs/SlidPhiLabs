import { test } from "node:test";
import assert from "node:assert/strict";
import { issueIdentity, verifyIdentity } from "./ed25519.mjs";

test("an expired identity is refused", () => {
  const token = issueIdentity({ agent_id: "lab-seat", ttl_seconds: -10 });
  assert.equal(verifyIdentity(token).reason, "expired");
});

test("an Ed25519 identity verifies and a flipped signature does not", () => {
  const token = issueIdentity({ agent_id: "lab-seat" });
  assert.equal(verifyIdentity(token).ok, true);
  const broken = { ...token, sig: token.sig.slice(0, -2) + (token.sig.endsWith("a") ? "b" : "a") };
  assert.equal(verifyIdentity(broken).ok, false);
});
