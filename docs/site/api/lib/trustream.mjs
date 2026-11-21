/**
 * TRUSTREAM tile pipe. 4 KB tiles. A quiet tile of zeros stores as a count.
 * Any other tile is stored raw. Decode returns the original bytes.
 * This is not a claim against xz or zstd.
 */
export const TRUSTREAM_TILE = 4096;
export const TRUSTREAM_MAGIC = Buffer.from("TS01");

function encodeTile(tile) {
  let zeros = true;
  for (let i = 0; i < tile.length; i += 1) {
    if (tile[i] !== 0) {
      zeros = false;
      break;
    }
  }
  if (zeros) {
    const out = Buffer.alloc(3);
    out[0] = 1;
    out.writeUInt16BE(tile.length, 1);
    return out;
  }
  const out = Buffer.alloc(3 + tile.length);
  out[0] = 0;
  out.writeUInt16BE(tile.length, 1);
  tile.copy(out, 3);
  return out;
}

export function encodeTrustream(raw) {
  const input = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  const parts = [TRUSTREAM_MAGIC, Buffer.alloc(4)];
  parts[1].writeUInt32BE(input.length, 0);
  for (let off = 0; off < input.length; off += TRUSTREAM_TILE) {
    parts.push(encodeTile(input.subarray(off, Math.min(off + TRUSTREAM_TILE, input.length))));
  }
  if (input.length === 0) parts.push(encodeTile(Buffer.alloc(0)));
  return Buffer.concat(parts);
}

export function decodeTrustream(blob) {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < 8 || !buf.subarray(0, 4).equals(TRUSTREAM_MAGIC)) {
    throw new Error("bad_magic");
  }
  const total = buf.readUInt32BE(4);
  const out = Buffer.alloc(total);
  let pos = 8;
  let written = 0;
  while (written < total) {
    if (pos + 3 > buf.length) throw new Error("truncated");
    const flag = buf[pos];
    const len = buf.readUInt16BE(pos + 1);
    pos += 3;
    if (written + len > total) throw new Error("oversize");
    if (flag === 1) {
      out.fill(0, written, written + len);
    } else if (flag === 0) {
      if (pos + len > buf.length) throw new Error("truncated");
      buf.copy(out, written, pos, pos + len);
      pos += len;
    } else {
      throw new Error("bad_tile");
    }
    written += len;
  }
  return out;
}
