import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, resolve } from "./exactodds.mjs";

test("the same seed picks the same outcome", () => {
  const outcomes = ["home", "away", "draw"];
  const a = draw("lab-seed", outcomes);
  const b = draw("lab-seed", outcomes);
  assert.equal(a.ok, true);
  assert.equal(a.pick, b.pick);
  assert.equal(resolve(a, a.pick).reason, "match");
  assert.equal(resolve(a, "nope").reason, "mismatch");
});

test("an empty list is refused", () => {
  assert.equal(draw("x", []).reason, "no_outcomes");
  assert.equal(resolve({ ok: false }, "home").reason, "no_draw");
});

test("two different seeds can differ and resolve refuses a draw that is not ok", () => {
  const outcomes = ["home", "away", "draw"];
  const picks = ["a", "b", "c"].map((seed) => draw(seed, outcomes));
  assert.equal(picks.every((row) => row.ok === true), true);
  assert.ok(new Set(picks.map((row) => row.pick)).size > 1);
  const refused = resolve(draw("a", []), outcomes[0]);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "no_draw");
});
