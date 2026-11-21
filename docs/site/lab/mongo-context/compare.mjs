/**
 * Stand-in for a WiredTiger block compressor swap.
 * WiredTiger calls WT_COMPRESSOR.compress on a page, not on a query.
 * This measures that call on Mongo-shaped context. It does not build mongod.
 *
 *   node docs/site/lab/mongo-context/compare.mjs
 */
import zlib from "node:zlib";
import { canonicalBytes, compressJsonKeys, decompressJsonKeys } from "../json_residual/json_keys.mjs";
import { decodeTrustream, encodeTrustream } from "../../api/lib/trustream.mjs";

function doc(i, words) {
  const messages = [];
  for (let n = 0; n < words; n += 1) {
    messages.push({
      role: n % 2 === 0 ? "user" : "assistant",
      at: "2026-11-21T12:00:00.000Z",
      text: `context block ${i} turn ${n} the agent remembered the last plan and the open file`,
    });
  }
  return {
    session_id: "sess_" + i,
    agent_id: "agt_lab",
    at: "2026-11-21T12:00:00.000Z",
    kind: "context",
    messages,
  };
}

function rawOf(value) {
  return Buffer.from(JSON.stringify(value));
}

function packZlib(buf) {
  return zlib.deflateSync(buf, { level: 6 });
}
function packZstd(buf) {
  if (typeof zlib.zstdCompressSync !== "function") return null;
  return zlib.zstdCompressSync(buf, { level: 3 });
}
function packJk(buf) {
  const value = JSON.parse(buf.toString("utf8"));
  const out = compressJsonKeys(value);
  const back = decompressJsonKeys(out.packed);
  if (back.json !== canonicalBytes(value).toString("utf8")) {
    throw new Error("jk01 round trip failed");
  }
  return out.packed;
}

function row(name, raw, packed) {
  return {
    name,
    raw: raw.length,
    packed: packed ? packed.length : null,
    ratio: packed ? +(packed.length / raw.length).toFixed(3) : null,
  };
}

function report(title, raw, codecs) {
  console.log("\n" + title + " raw " + raw.length);
  for (const [name, packed] of codecs) {
    const line = row(name, raw, packed);
    console.log(
      name.padEnd(12),
      line.packed == null ? "absent" : String(line.packed).padStart(8),
      line.ratio == null ? "" : "ratio " + line.ratio
    );
  }
}

const fat = rawOf(doc(1, 80));
const smalls = [];
for (let i = 0; i < 40; i += 1) smalls.push(rawOf(doc(i, 2)));
const smallSum = smalls.reduce((n, b) => n + b.length, 0);
const page = Buffer.concat(smalls);

function sumCodec(fn) {
  let n = 0;
  for (const b of smalls) {
    const p = fn(b);
    if (p == null) return null;
    n += p.length;
  }
  return Buffer.alloc(n);
}

const zlibFat = packZlib(fat);
const zstdFat = packZstd(fat);
const jkFat = packJk(fat);
const tsFat = encodeTrustream(fat);
if (!decodeTrustream(tsFat).equals(fat)) throw new Error("trustream round trip failed");
if (!zlib.inflateSync(zlibFat).equals(fat)) throw new Error("zlib round trip failed");

report("one fat context document", fat, [
  ["zlib-6", zlibFat],
  ["zstd-3", zstdFat],
  ["JK01", jkFat],
  ["TRUSTREAM", tsFat],
]);

const zlibEach = sumCodec(packZlib);
const zstdEach = sumCodec(packZstd);
const jkEach = sumCodec(packJk);
const tsEach = sumCodec(encodeTrustream);
console.log("\n40 small context docs, compressed one by one, raw " + smallSum);
for (const [name, packed] of [
  ["zlib-6", zlibEach],
  ["zstd-3", zstdEach],
  ["JK01", jkEach],
  ["TRUSTREAM", tsEach],
]) {
  console.log(name.padEnd(12), packed ? packed.length : "absent", packed ? "ratio " + (packed.length / smallSum).toFixed(3) : "");
}

report("same 40 docs packed as one WiredTiger-sized page", page, [
  ["zlib-6", packZlib(page)],
  ["zstd-3", packZstd(page)],
  ["JK01", null],
  ["TRUSTREAM", encodeTrustream(page)],
]);

const quiet = Buffer.alloc(32 * 1024);
report("32KB zero page", quiet, [
  ["zlib-6", packZlib(quiet)],
  ["zstd-3", packZstd(quiet)],
  ["TRUSTREAM", encodeTrustream(quiet)],
]);
