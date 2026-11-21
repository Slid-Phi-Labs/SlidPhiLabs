import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** Thirteen ACP layers, each pointed at a file that already exists. */
export const ACP_LAYERS = [
  ["identity", "lab-board/identity/ed25519.mjs"],
  ["warrant", "docs/site/api/lib/warrant.mjs"],
  ["chamber", "docs/site/api/lib/chamber-seal.mjs"],
  ["payments", "docs/site/api/lib/acn-accounting.mjs"],
  ["depot", "docs/site/api/lib/depot-receipts.mjs"],
  ["receipt", "docs/site/api/warrant/receipt.js"],
  ["exactness", "docs/site/api/lib/exactness-gate.mjs"],
  ["quote", "docs/site/api/lib/call-doors.mjs"],
  ["refusal", "docs/site/acn-protocol/schemas/error.json"],
  ["catalog", "docs/site/acn-protocol/schemas/catalog-product.json"],
  ["plan", "docs/site/acn-protocol/schemas/plan-spec.json"],
  ["research", "docs/site/acn-protocol/schemas/research-args.json"],
  ["claim", "docs/site/acn-protocol/schemas/claim-token.json"],
];

export function missingAcpLayers() {
  return ACP_LAYERS.filter(([, rel]) => !existsSync(join(root, rel))).map(([name]) => name);
}
