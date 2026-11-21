import { test } from "node:test";
import assert from "node:assert/strict";
import { silentErrors } from "./silent-rules.mjs";

test("money float is a silent error and cents are not", () => {
  assert.equal(silentErrors("const price = 1.25").some((row) => row.rule === "money-float"), true);
  assert.equal(silentErrors("const priceCents = 125").some((row) => row.rule === "money-float"), false);
});

test("bare Date and a float token amount are silent errors", () => {
  const rows = silentErrors("const t = new Date(); const lamports = 1.5");
  assert.deepEqual(rows.map((row) => row.rule).sort(), ["crypto-float", "time-local"]);
});
