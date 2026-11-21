import { test } from "node:test";
import assert from "node:assert/strict";
import { ACP_LAYERS, missingAcpLayers } from "./acp-layers.mjs";

test("ACP has thirteen layers and each file is on disk", () => {
  assert.equal(ACP_LAYERS.length, 13);
  assert.deepEqual(missingAcpLayers(), []);
});
