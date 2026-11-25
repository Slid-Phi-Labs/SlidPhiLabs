import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import {
  CUNI_TOOLS,
  CUNI_VERBS,
  cuniVerb,
  dispatchCuni,
} from "./cuni-calls.mjs";

const NINE = [
  "check",
  "translate",
  "ingest",
  "audit",
  "money",
  "time",
  "chain",
  "ship",
  "parity",
];

test("nine verbs, same names as the CLI", () => {
  assert.deepEqual(CUNI_VERBS, NINE);
  assert.equal(CUNI_TOOLS.length, 9);
  assert.deepEqual(
    CUNI_TOOLS.map((t) => t.name),
    NINE,
  );
});

test("tool schemas carry source and read-only annotations", () => {
  for (const t of CUNI_TOOLS) {
    assert.equal(t.inputSchema.type, "object");
    assert.ok(t.inputSchema.properties.source);
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.destructiveHint, false);
  }
  const byName = Object.fromEntries(CUNI_TOOLS.map((t) => [t.name, t]));
  assert.deepEqual(byName.audit.inputSchema.required, ["source", "against"]);
  assert.deepEqual(byName.translate.inputSchema.required, ["source"]);
  assert.ok(byName.chain.inputSchema.properties.to);
  assert.ok(byName.translate.inputSchema.properties.from);
});

test("verb canonicalization covers aliases and rejects unknown", () => {
  assert.equal(cuniVerb("check"), "check");
  assert.equal(cuniVerb("cuni_bank"), "translate");
  assert.equal(cuniVerb("bank_paste"), "translate");
  assert.equal(cuniVerb("cuni_check"), "check");
  assert.equal(cuniVerb("nope"), null);
  assert.equal(cuniVerb(""), null);
});

test("dispatch rejects unknown verbs without network", async () => {
  assert.equal(await dispatchCuni("nope", { source: "x" }), null);
});

function stub(routes) {
  const seen = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
      const out = routes[req.url] || { ok: true };
      const payload = JSON.stringify(out);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(payload);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, seen, port: server.address().port }),
    );
  });
}

test("dispatch fills per-verb defaults", async () => {
  const { server, seen, port } = await stub({
    "/v1/translate": { ok: true, emit: "js" },
    "/v1/audit": { ok: true, verdict: "PASS" },
  });
  const saved = process.env.LAB_CALLS_URL;
  process.env.LAB_CALLS_URL = `http://127.0.0.1:${port}`;
  try {
    const tr = await dispatchCuni("translate", { source: "print(1)" });
    assert.equal(tr.status, 200);
    assert.equal(tr.verb, "translate");
    assert.equal(tr.sku, "lab-translate");
    const au = await dispatchCuni("cuni_bank", {
      source: "law",
      against: "impl.py",
    });
    assert.equal(au.verb, "translate");
  } finally {
    if (saved === undefined) delete process.env.LAB_CALLS_URL;
    else process.env.LAB_CALLS_URL = saved;
    server.close();
  }
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0].body, {
    source: "print(1)",
    from: "py",
    to: "js",
  });
  assert.deepEqual(seen[1].body, {
    source: "law",
    from: "py",
    to: "js",
  });
  // cuni_bank aliases to translate, so the audit stub stays untouched
  assert.ok(!seen.some((s) => s.url === "/v1/audit"));
});

test("dispatch honors LAB_CALLS_URL with verb bodies", async () => {
  const { server, seen, port } = await stub({
    "/v1/check": { ok: true },
    "/v1/chain": { ok: true, seats: ["sol"] },
    "/v1/audit": { ok: true, verdict: "PASS" },
  });
  const saved = process.env.LAB_CALLS_URL;
  process.env.LAB_CALLS_URL = `http://127.0.0.1:${port}`;
  try {
    const check = await dispatchCuni("check", { source: "fn main(){}" });
    assert.equal(check.status, 200);
    assert.equal(check.verb, "check");
    assert.equal(check.sku, "lab-check");
    const chain = await dispatchCuni(
      "chain",
      { source: "contract {}", to: "sol", payment: "p" },
      {},
    );
    assert.equal(chain.status, 200);
    assert.equal(chain.sku, "lab-chain");
    const audit = await dispatchCuni("audit", {
      source: "law",
      against: "impl.py",
    });
    assert.equal(audit.status, 200);
    assert.equal(audit.verdict, "PASS");
    assert.equal(audit.sku, "lab-audit");
  } finally {
    if (saved === undefined) delete process.env.LAB_CALLS_URL;
    else process.env.LAB_CALLS_URL = saved;
    server.close();
  }
  const urls = seen.map((s) => s.url);
  assert.deepEqual(urls, ["/v1/check", "/v1/chain", "/v1/audit"]);
  const [checkReq, chainReq] = seen;
  assert.equal(checkReq.body.source, "fn main(){}");
  assert.equal(checkReq.headers["x-payment"], undefined);
  assert.deepEqual(chainReq.body, { source: "contract {}", to: "sol" });
  assert.equal(chainReq.headers["x-payment"], "p");
  assert.equal(chainReq.headers["payment-signature"], "p");
  const auditReq = seen[2];
  assert.deepEqual(auditReq.body, {
    source: "law",
    against: "impl.py",
    against_ext: "py",
  });
});
