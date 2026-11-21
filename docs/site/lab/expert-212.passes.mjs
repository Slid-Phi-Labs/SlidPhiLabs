/**
 * 212 checks on the expert gates: exactness, exact odds, silent rules,
 * the two-key chamber, and TRUSTREAM.
 * node docs/site/lab/expert-212.passes.mjs
 */
import assert from "node:assert/strict";
import { exactnessGate } from "../api/lib/exactness-gate.mjs";
import { draw, resolve } from "../api/lib/exactodds.mjs";
import { silentErrors } from "../../../lab-board/cuni/silent-rules.mjs";
import { openEnvelope, sealEnvelope } from "../api/lib/chamber-seal.mjs";
import { decodeTrustream, encodeTrustream } from "../api/lib/trustream.mjs";

const results = [];
function check(bucket, name, fn) {
  try {
    fn();
    results.push({ bucket, name, ok: true });
  } catch (err) {
    results.push({ bucket, name, ok: false, err: String(err && err.message ? err.message : err) });
  }
}

const KEY = "ab".repeat(32);
const KEY2 = "cd".repeat(32);

for (let i = 0; i < 24; i += 1) {
  check("exactness", "keep " + i, () => {
    const stdout = "same-" + (i % 3);
    const gate = exactnessGate([
      { name: "a" + i, stdout },
      { name: "b" + i, stdout },
    ]);
    assert.equal(gate.ok, true);
    assert.equal(gate.stdout, stdout);
  });
}
for (let i = 0; i < 12; i += 1) {
  check("exactness", "refuse " + i, () => {
    const gate = exactnessGate([
      { name: "a", stdout: "one" },
      { name: "b" + i, stdout: "two" },
    ]);
    assert.equal(gate.ok, false);
    assert.equal(gate.reason, "mismatch");
  });
}

const outcomes = ["keep", "fold", "pass"];
for (let i = 0; i < 30; i += 1) {
  check("exactodds", "stable " + i, () => {
    const seed = "moosha-" + i;
    const a = draw(seed, outcomes);
    const b = draw(seed, outcomes);
    assert.equal(a.ok, true);
    assert.equal(a.pick, b.pick);
    assert.equal(resolve(a, a.pick).reason, "match");
  });
}
for (let i = 0; i < 12; i += 1) {
  check("exactodds", "mismatch " + i, () => {
    const drawn = draw("seed-" + i, outcomes);
    const other = outcomes.find((item) => item !== drawn.pick);
    assert.equal(resolve(drawn, other).reason, "mismatch");
  });
}
for (let i = 0; i < 8; i += 1) {
  check("exactodds", "empty " + i, () => {
    assert.equal(draw("x" + i, []).reason, "no_outcomes");
    assert.equal(resolve({ ok: false }, "keep").reason, "no_draw");
  });
}

for (let i = 0; i < 20; i += 1) {
  check("silent", "money float " + i, () => {
    const found = silentErrors("const amount = " + (i + 1) + ".5; const price = amount;");
    assert.ok(found.some((row) => row.rule === "money-float"));
  });
}
for (let i = 0; i < 16; i += 1) {
  check("silent", "cents clean " + i, () => {
    const found = silentErrors("const amountCents = " + i + "; const price = amountCents;");
    assert.equal(found.some((row) => row.rule === "money-float"), false);
  });
}
for (let i = 0; i < 10; i += 1) {
  check("silent", "local date " + i, () => {
    const found = silentErrors("const t = new Date(" + i + ");");
    assert.ok(found.some((row) => row.rule === "time-local"));
  });
}

for (let i = 0; i < 20; i += 1) {
  check("chamber", "two keys " + i, () => {
    const env = sealEnvelope({ n: i, note: "expert" }, { keyHex: KEY, keyHex2: KEY2 });
    assert.equal(env.v, 2);
    assert.equal(openEnvelope(env, { keyHex: KEY, keyHex2: KEY2 }).ok, true);
    assert.equal(openEnvelope(env, { keyHex: KEY }).ok, false);
  });
}
for (let i = 0; i < 16; i += 1) {
  check("chamber", "one key " + i, () => {
    const env = sealEnvelope({ n: i, note: "one-key" }, { keyHex: KEY });
    assert.equal(env.v, 1);
    assert.equal(openEnvelope(env, { keyHex: KEY }).ok, true);
  });
}
for (let i = 0; i < 4; i += 1) {
  check("chamber", "bad key " + i, () => {
    assert.equal(sealEnvelope({ n: i }, { keyHex: "ab" }), null);
  });
}

for (let i = 0; i < 28; i += 1) {
  check("trustream", "round trip " + i, () => {
    const raw = Buffer.alloc(64 + i, i % 7 === 0 ? 0 : 65 + (i % 20));
    raw.write("expert-" + i);
    assert.deepEqual(decodeTrustream(encodeTrustream(raw)), raw);
  });
}
for (let i = 0; i < 12; i += 1) {
  check("trustream", "bad magic " + i, () => {
    assert.throws(() => decodeTrustream(Buffer.from("NOPE" + i)), /bad_magic/);
  });
}

const failed = results.filter((r) => !r.ok);
const by = new Map();
for (const row of results) by.set(row.bucket, (by.get(row.bucket) || 0) + 1);
console.log("passes " + results.length + " failed " + failed.length);
for (const [bucket, n] of by) console.log(n + "\t" + bucket);
for (const f of failed.slice(0, 12)) console.error("FAIL " + f.bucket + " " + f.name + " " + f.err);
if (results.length !== 212 || failed.length) process.exit(1);
console.log("expert-212: passed, with love from moosha");
