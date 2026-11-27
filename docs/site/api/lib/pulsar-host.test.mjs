import { test } from "node:test";
import assert from "node:assert/strict";
import { looksPulsar, magicOf } from "./pulsar-host.mjs";

test("pulsar magic is recognized and a short buffer is not", () => {
  assert.equal(looksPulsar(Buffer.from("BW23rest")), true);
  assert.equal(looksPulsar(Buffer.from("PZ22rest")), true);
  assert.equal(looksPulsar(Buffer.from("nope")), false);
  assert.equal(looksPulsar(Buffer.from("BW")), false);
});

test("magicOf returns each pulsar magic or null", () => {
  for (const magic of ["BW23", "BW22", "OZL2", "PZ22"]) {
    const buf = Buffer.from(magic + "rest");
    assert.equal(magicOf(buf), magic);
    assert.equal(looksPulsar(buf), true);
  }
  assert.equal(magicOf(Buffer.from("nope")), null);
  assert.equal(looksPulsar(Buffer.from("nope")), false);
});

test("invalid pulsar buffers are rejected", () => {
  assert.equal(looksPulsar(Buffer.alloc(0)), false);
  assert.equal(magicOf(Buffer.from("FAIL")), null);
  assert.equal(looksPulsar(Buffer.from("wrong")), false);
});
