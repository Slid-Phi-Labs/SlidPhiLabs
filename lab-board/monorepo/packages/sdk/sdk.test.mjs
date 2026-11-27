import { test } from "node:test";
import assert from "node:assert/strict";
import { issueIdentity, verifyIdentity, silentErrors } from "./index.mjs";

test("sdk re-exports a working identity roundtrip", () => {
  const id = issueIdentity({ agent_id: "lab-sdk" });
  assert.equal(verifyIdentity(id).ok, true);
});

test("sdk refuses tampered and expired identities", () => {
  const good = issueIdentity({ agent_id: "lab-sdk" });
  const tampered = { ...good, sig: good.sig.slice(0, -2) + "AA" };
  assert.equal(verifyIdentity(tampered).reason, "bad_signature");
  const stale = issueIdentity({ agent_id: "lab-sdk", ttl_seconds: -10 });
  assert.equal(verifyIdentity(stale).reason, "expired");
});

test("sdk re-exports the silent-error rules", () => {
  assert.equal(
    silentErrors("const price = 1.25").some((row) => row.rule === "money-float"),
    true,
  );
  assert.equal(silentErrors("const priceCents = 125").length, 0);
});
