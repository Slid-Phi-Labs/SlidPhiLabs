import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));

function load(rel) {
  return JSON.parse(readFileSync(join(dir, rel), "utf8"));
}

test("every ACN example satisfies its schema's required fields", () => {
  const names = Object.keys(index.examples);
  assert.ok(names.length >= 10);
  for (const name of names) {
    const schema = load(index.schemas[name]);
    const example = load(index.examples[name]);
    if (schema.type === "string") {
      assert.match(example, new RegExp(schema.pattern), name);
      continue;
    }
    for (const key of schema.required || []) {
      assert.ok(Object.prototype.hasOwnProperty.call(example, key), `${name} missing ${key}`);
    }
    if (schema.anyOf) {
      const ok = schema.anyOf.some((branch) => (branch.required || []).every((key) => example[key] != null));
      assert.equal(ok, true, name);
    }
  }
});
