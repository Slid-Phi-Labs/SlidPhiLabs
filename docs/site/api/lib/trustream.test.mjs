import assert from "node:assert/strict";
import test from "node:test";
import { decodeTrustream, encodeTrustream, TRUSTREAM_TILE } from "./trustream.mjs";

test("zeros pack and a busy tile round-trips", () => {
  const raw = Buffer.alloc(TRUSTREAM_TILE + 8);
  raw.write("busy-bytes", TRUSTREAM_TILE);
  const packed = encodeTrustream(raw);
  assert.ok(packed.length < raw.length);
  assert.deepEqual(decodeTrustream(packed), raw);
});

test("a tile that is not quiet is stored raw and still round-trips", () => {
  const raw = Buffer.from("abcdefghijklmnopqrstuvwxyz012345");
  assert.deepEqual(decodeTrustream(encodeTrustream(raw)), raw);
});

test("a bad magic is refused", () => {
  assert.throws(() => decodeTrustream(Buffer.from("NOPE")), /bad_magic/);
});
