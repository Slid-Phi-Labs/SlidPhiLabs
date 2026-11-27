import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const pointer = readFileSync(join(dir, "ledger.sql"), "utf8");
const schema = readFileSync(
  join(dir, "..", "..", "..", "identity", "ledger.sql"),
  "utf8"
);

function tablesIn(sql) {
  return [...sql.matchAll(/create table if not exists (\w+)/gi)].map(
    (m) => m[1]
  );
}

test("pointer names the identity schema file", () => {
  assert.ok(pointer.includes("lab-board/identity/ledger.sql"));
});

test("schema carries both ledger tables with their keys", () => {
  assert.deepEqual(tablesIn(schema), ["agent_identity", "identity_receipt"]);
  assert.ok(schema.includes("primary key"));
  assert.ok(schema.includes("references agent_identity(agent_id)"));
});

test("a schema with a mismatched table name is flagged", () => {
  const broken = schema.replace("identity_receipt", "identity_recept");
  assert.ok(!tablesIn(broken).includes("identity_receipt"));
});

test("package entry reads the same schema", async () => {
  const entry = await import("./src/index.mjs");
  assert.ok(entry.readLedgerSchema().includes("agent_identity"));
  assert.ok(entry.readLedgerPointer().includes("lab-board/identity/ledger.sql"));
});
