/**
 * Hosted pulsar 2.5.0. GPL-3.0-or-later.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export function pulsarBin() {
  return process.env.PULSAR_BIN || join(process.cwd(), "bin", "pulsar");
}

export async function pulsarEncode(raw, { timeoutMs = 60_000 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "spl-pulsar-"));
  const inn = join(dir, "in.bin");
  const out = join(dir, "out.pulsar");
  try {
    await writeFile(inn, raw);
    await execFileP(pulsarBin(), ["encode", inn, "-o", out], {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    return await readFile(out);
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (/not compressible/i.test(msg)) return null;
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function pulsarDecode(blob, { timeoutMs = 60_000 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "spl-pulsar-d-"));
  const inn = join(dir, "in.pulsar");
  const out = join(dir, "out.bin");
  try {
    await writeFile(inn, blob);
    await execFileP(pulsarBin(), ["decode", inn, "-o", out], {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
    });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const PULSAR_MAGICS = new Set(["BW23", "BW22", "OZL2", "PZ22"]);

/** Four-byte pulsar magic, or null when the buffer is short or not a magic. */
export function magicOf(buf) {
  if (!buf || buf.length < 4) return null;
  const m = buf.subarray(0, 4).toString("latin1");
  return PULSAR_MAGICS.has(m) ? m : null;
}

export function looksPulsar(buf) {
  return magicOf(buf) !== null;
}
