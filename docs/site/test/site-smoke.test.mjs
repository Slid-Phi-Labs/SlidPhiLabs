import { test } from "node:test";
import assert from "node:assert/strict";
import { aliasTool, siteRewrite } from "../api/lib/call-doors.mjs";

test("v1 warrant paths rewrite to api handlers", () => {
  assert.equal(siteRewrite("/v1/warrant/revoke"), "/api/warrant/revoke");
  assert.equal(siteRewrite("/v1/warrant/release"), "/api/warrant/release");
});

test("unknown paths and tools are refused without network", () => {
  assert.equal(siteRewrite("/nope-xyz"), null);
  assert.equal(aliasTool("compress"), "spl_compress");
  assert.equal(aliasTool("bogus-tool"), null);
});
