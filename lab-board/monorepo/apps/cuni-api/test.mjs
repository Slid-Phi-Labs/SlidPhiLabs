import { test } from "node:test";
import assert from "node:assert/strict";
import { silentErrors } from "../../../cuni/silent-rules.mjs";

test("cuni api package flags a money float", () => {
  assert.equal(silentErrors("const price = 1.5").length, 1);
});
