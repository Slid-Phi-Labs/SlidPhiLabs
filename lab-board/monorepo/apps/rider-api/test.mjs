import { test } from "node:test";
import assert from "node:assert/strict";
import { issueIdentity, verifyIdentity } from "../../../identity/ed25519.mjs";

test("rider api package can issue an identity", () => {
  assert.equal(verifyIdentity(issueIdentity({ agent_id: "rider-api" })).ok, true);
});
