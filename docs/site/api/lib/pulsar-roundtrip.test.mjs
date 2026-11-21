import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { pulsarBin, pulsarDecode, pulsarEncode } from "./pulsar-host.mjs";

test("pulsar encode then decode returns the same bytes when the binary is present", async () => {
  if (!existsSync(pulsarBin())) {
    console.log("pulsar binary absent: " + pulsarBin());
    return;
  }
  const raw = Buffer.from("pulsar round trip bytes");
  const blob = await pulsarEncode(raw);
  assert.ok(blob && blob.length > 4);
  const back = await pulsarDecode(blob);
  assert.deepEqual(back, raw);
});
