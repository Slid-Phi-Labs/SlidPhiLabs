import { test } from "node:test";
import assert from "node:assert/strict";
import { ACP_LAYERS, missingAcpLayers } from "./acp-layers.mjs";

test("AcP has thirteen layers and each file is on disk", () => {
  assert.equal(ACP_LAYERS.length, 13);
  assert.deepEqual(missingAcpLayers(), []);
});

test("AcP rejects unknown layer names as invalid", () => {
  const ids = new Set(ACP_LAYERS.map(([id]) => id));
  assert.equal(ids.has("not-a-layer"), false);
  assert.equal(ids.has(""), false);
  assert.ok(!ids.has("invalid"));
});
