import test from "node:test";
import assert from "node:assert/strict";
import { openPortal } from "./billing-portal.js";

function fakeFetch(map) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, init });
    const hit = map.find((m) => url.includes(m.match));
    return { ok: hit.status < 400, status: hit.status, json: async () => hit.body };
  };
  f.calls = calls;
  return f;
}

test("portal: bad id 400, no key 503, one-time purchase 409", async () => {
  assert.equal((await openPortal({ sessionId: "nope", origin: "https://x", key: "k" })).status, 400);
  assert.equal((await openPortal({ sessionId: "cs_test_abc", origin: "https://x", key: "" })).status, 503);
  const f = fakeFetch([{ match: "/checkout/sessions/", status: 200, body: { mode: "payment", customer: null } }]);
  assert.equal((await openPortal({ sessionId: "cs_test_abc", origin: "https://x", key: "k", fetchImpl: f })).status, 409);
});

test("portal: subscription session opens the customer's portal with a return url", async () => {
  const f = fakeFetch([
    { match: "/checkout/sessions/", status: 200, body: { mode: "subscription", customer: "cus_9" } },
    { match: "/billing_portal/sessions", status: 200, body: { url: "https://billing.stripe.com/p/session/x" } },
  ]);
  const out = await openPortal({ sessionId: "cs_test_abc", origin: "https://www.slidphilabs.com", key: "k", fetchImpl: f, configuration: "bpc_123" });
  assert.equal(out.status, 200);
  assert.equal(out.body.url, "https://billing.stripe.com/p/session/x");
  const body = new URLSearchParams(f.calls[1].init.body);
  assert.equal(body.get("customer"), "cus_9");
  assert.equal(body.get("configuration"), "bpc_123");
  assert.equal(body.get("return_url"), "https://www.slidphilabs.com/access?session_id=cs_test_abc");
});
