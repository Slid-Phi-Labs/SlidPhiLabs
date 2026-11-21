import { test } from "node:test";
import assert from "node:assert/strict";
import { handleQuikgater, quikgaterLive } from "./quikgater.js";

test("live only when 400, 402, and the render box agree", () => {
  const health = { ok: true, status: 200 };
  assert.equal(quikgaterLive({ missing: { status: 400 }, unpaid: { status: 402 }, health }), true);
  assert.equal(quikgaterLive({ missing: { status: 200 }, unpaid: { status: 402 }, health }), false);
  assert.equal(quikgaterLive({ missing: { status: 400 }, unpaid: { status: 200 }, health }), false);
  assert.equal(quikgaterLive({ missing: { status: 400 }, unpaid: { status: 402 }, health: { ok: false } }), false);
});

function mockRes() {
  return {
    statusCode: 0,
    body: "",
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(payload) { this.body = payload || ""; },
  };
}

test("the handler reports live from injected checks and refuses a POST", async () => {
  const ok = mockRes();
  await handleQuikgater({ method: "GET" }, ok, async (url) => {
    if (url.endsWith("/health")) return { ok: true, status: 200 };
    if (url.includes("url=")) return { ok: true, status: 402 };
    return { ok: true, status: 400 };
  });
  const live = JSON.parse(ok.body);
  assert.equal(live.ok, true);
  assert.equal(live.product, "quikgater");
  assert.equal(live.live, true);

  const down = mockRes();
  await handleQuikgater({ method: "GET" }, down, async () => ({ ok: false, status: 500 }));
  assert.equal(JSON.parse(down.body).live, false);

  const denied = mockRes();
  await handleQuikgater({ method: "POST" }, denied, async () => { throw new Error("network"); });
  assert.equal(denied.statusCode, 405);
});
