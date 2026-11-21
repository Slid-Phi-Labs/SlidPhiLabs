import { test } from "node:test";
import assert from "node:assert/strict";
import { exactnessGate } from "./exactness-gate.mjs";

test("matching stdout is kept", () => {
  const kept = exactnessGate([
    { name: "py", stdout: "1\n" },
    { name: "js", stdout: "1\n" },
  ]);
  assert.equal(kept.ok, true);
  assert.equal(kept.stdout, "1\n");
});

test("one different stdout is refused", () => {
  const refused = exactnessGate([
    { name: "py", stdout: "1\n" },
    { name: "js", stdout: "2\n" },
  ]);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "mismatch");
  assert.deepEqual(refused.seats, ["js"]);
});
