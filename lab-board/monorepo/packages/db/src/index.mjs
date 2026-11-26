/**
 * @slidphi/db — schema pointer for Ed25519 agent identity ledger.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * The SQL lives at lab-board/identity/ledger.sql. This package does not
 * apply migrations to a server; it exports the path for tooling/tests.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");

/** Relative pointer file shipped beside package.json. */
export const LEDGER_POINTER = join(pkgRoot, "ledger.sql");

/** Absolute path to the identity ledger schema (repo layout). */
export const LEDGER_SCHEMA = join(
  pkgRoot,
  "..",
  "..",
  "..",
  "identity",
  "ledger.sql",
);

export function readLedgerSchema() {
  return readFileSync(LEDGER_SCHEMA, "utf8");
}

export function readLedgerPointer() {
  return readFileSync(LEDGER_POINTER, "utf8");
}
