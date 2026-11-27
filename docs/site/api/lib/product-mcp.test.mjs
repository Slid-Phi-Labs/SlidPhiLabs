/** Product MCP doors — every lab product callable. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAB_PRODUCTS,
  PRODUCT_TOOLS,
  isProductTool,
  dispatchProductTool,
  PRODUCT_MCP_VERSION,
} from "./product-mcp.mjs";
import { TOOLS } from "../mcp.js";

test("every lab product has a registered MCP tool", () => {
  const toolNames = new Set(PRODUCT_TOOLS.map((t) => t.name));
  for (const p of LAB_PRODUCTS) {
    assert.ok(toolNames.has(p.tool), `missing tool for ${p.id}: ${p.tool}`);
  }
});

test("product tools are listed on the live MCP server", () => {
  const live = new Set(TOOLS.map((t) => t.name));
  for (const t of PRODUCT_TOOLS) {
    assert.ok(live.has(t.name), `TOOLS missing ${t.name}`);
    assert.equal(isProductTool(t.name), true);
  }
});

test("spl_products lists all products", async () => {
  const out = await dispatchProductTool("spl_products", {});
  assert.equal(out.ok, true);
  assert.equal(out.version, PRODUCT_MCP_VERSION);
  assert.equal(out.count, LAB_PRODUCTS.length);
  assert.equal(out.products.length, LAB_PRODUCTS.length);
});

test("spl_product_call routes gitdepot receipt fail-closed and quote", async () => {
  const bad = await dispatchProductTool("spl_product_call", {
    product: "gitdepot",
    op: "receipt",
    team: "lab",
    sha256: "nope",
    bytes: 10,
  });
  assert.equal(bad.ok, false);

  const quote = await dispatchProductTool("spl_gitdepot", { op: "quote", bytes: 1000 });
  assert.equal(quote.ok, true);
  assert.equal(quote.quoted_cents, 0);

  const publish = await dispatchProductTool("spl_gitdepot", {
    op: "publish",
    name: "demo",
    data_b64: Buffer.from("hi").toString("base64"),
  });
  assert.equal(publish.ok, false);
  assert.equal(publish.reason, "adapter_required");
});

test("exactodds draw is deterministic", async () => {
  const a = await dispatchProductTool("spl_exactodds", {
    op: "draw",
    seed: "seed-1",
    outcomes: ["a", "b", "c"],
  });
  const b = await dispatchProductTool("spl_exactodds", {
    op: "draw",
    seed: "seed-1",
    outcomes: ["a", "b", "c"],
  });
  assert.equal(a.ok, true);
  assert.equal(a.pick, b.pick);
});

test("trustream pack/unpack round trip", async () => {
  const raw = Buffer.from("hello trustream");
  const packed = await dispatchProductTool("spl_trustream", {
    op: "pack",
    data_b64: raw.toString("base64"),
  });
  assert.equal(packed.ok, true);
  const back = await dispatchProductTool("spl_trustream", {
    op: "unpack",
    packed_b64: packed.packed_b64,
  });
  assert.equal(back.ok, true);
  assert.equal(Buffer.from(back.data_b64, "base64").toString("utf8"), "hello trustream");
});

test("agenthq slug validate", async () => {
  const bad = await dispatchProductTool("spl_agenthq", { op: "validate_slug", slug: "api" });
  assert.equal(bad.ok, false);
  const good = await dispatchProductTool("spl_agenthq", { op: "validate_slug", slug: "acme-lab" });
  assert.equal(good.ok, true);
  assert.equal(good.slug, "acme-lab");
});

test("acp layers and psi seats cards", async () => {
  const layers = await dispatchProductTool("spl_acp", { op: "layers" });
  assert.equal(layers.ok, true);
  assert.ok(layers.layers.length >= 13);
  const psi = await dispatchProductTool("spl_psi", { op: "seats" });
  assert.equal(psi.ok, true);
  assert.equal(psi.seats["psi-meter"].usd, 25);
});

test("conductor intent + list offline", async () => {
  const intent = await dispatchProductTool("spl_conductor", {
    op: "intent",
    prompt: "mcp product door check",
  });
  assert.equal(intent.ok, true);
  assert.ok(intent.task_id);
  const listed = await dispatchProductTool("spl_conductor", { op: "list" });
  assert.equal(listed.ok, true);
  assert.ok(Array.isArray(listed.tasks));
});

test("unknown product fails closed", async () => {
  const out = await dispatchProductTool("spl_product_call", { product: "nope", op: "card" });
  assert.equal(out.ok, false);
  assert.equal(out.error, "unknown_product");
});
