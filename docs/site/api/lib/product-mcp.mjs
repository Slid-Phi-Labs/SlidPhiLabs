/**
 * One MCP call surface per lab product.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Every named lab product gets a `spl_<product>` tool with an `op` argument.
 * Engines reuse existing libs; live adapters fail closed when unset.
 * Do not invent prices here — cards point at /pay and pricing.json SKUs.
 */
import { createHash } from "node:crypto";
import { buildDepotReceipt, defaultDepotPrice, DEPOT_FREE_BYTES, DEPOT_OPS } from "./depot-receipts.mjs";
import { createDepotStore } from "./depot-store.mjs";
import { draw as exactDraw, resolve as exactResolve } from "./exactodds.mjs";
import { encodeTrustream, decodeTrustream } from "./trustream.mjs";
import { sealEnvelope, openEnvelope } from "./chamber-seal.mjs";
import { intentTask, getTask, listTasks, pushTask, reviewTask, approveTask, rejectTask } from "./conductor-tasks.mjs";
import { reviewChanges, diffStat } from "./conductor-review.mjs";
import { validateSlug } from "./hq-slug.mjs";
import { ACP_LAYERS, missingAcpLayers } from "./acp-layers.mjs";
import { pulsarEncode, pulsarDecode, pulsarBin } from "./pulsar-host.mjs";
import { dispatchFetch } from "./call-doors.mjs";
import { computeQuote } from "../suite-pricing.js";

export const PRODUCT_MCP_VERSION = "1.0.0";
const SITE = "https://www.slidphilabs.com";

function text(v) {
  return v == null ? "" : String(v).trim();
}

function sha256hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function b64ToBuf(s) {
  return Buffer.from(String(s || ""), "base64");
}

function tool(name, description, properties, required = [], mutating = false) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: true,
    },
    annotations: {
      readOnlyHint: !mutating,
      destructiveHint: false,
      idempotentHint: !mutating,
      openWorldHint: true,
    },
  };
}

const opProp = (ops, extra = "Required.") => ({
  type: "string",
  description: `Operation: ${ops.join(" | ")}. ${extra}`,
});

/** Canonical product registry for discovery + dispatch. */
export const LAB_PRODUCTS = Object.freeze([
  {
    id: "arn",
    tool: "spl_arn",
    ops: ["card"],
    page: SITE + "/mcp-service",
    note: "ArN — Agent Commerce Network — hosted MCP at /mcp (branding ArN, not ACN)",
  },
  {
    id: "acp",
    tool: "spl_acp",
    ops: ["layers", "card"],
    page: SITE + "/acp",
    note: "AcP — Agent Commerce Protocol layers (branding AcP, not ACP)",
  },
  {
    id: "rider",
    tool: "spl_rider",
    ops: ["card"],
    page: SITE + "/rider",
    note: "ES256 agent identity; live host Agent-Rider",
  },
  {
    id: "warrant",
    tool: "spl_warrant",
    ops: ["card"],
    page: SITE + "/warrant",
    note: "Spend mandate — use spl_warrant_* family for issue/verify/reserve/receipt",
  },
  {
    id: "chamber",
    tool: "spl_chamber",
    ops: ["seal", "open", "card"],
    page: SITE + "/chamber",
    note: "Two-key JSON seal",
  },
  {
    id: "pcc",
    tool: "spl_pcc",
    ops: ["compress", "decompress", "quote", "card"],
    page: SITE + "/pcc",
    note: "Hosted lossless compression — also spl_compress / spl_quote",
  },
  {
    id: "trustream",
    tool: "spl_trustream",
    ops: ["pack", "unpack", "card"],
    page: SITE + "/pcc",
    note: "4 KB tile pipe bundled with PCC story",
  },
  {
    id: "cuni",
    tool: "spl_cuni",
    ops: ["card"],
    page: SITE + "/cuni",
    note: "Exactness — use translate/check/audit CuNi tools and cuni_bank",
  },
  {
    id: "psi",
    tool: "spl_psi",
    ops: ["card", "seats"],
    page: SITE + "/persist",
    note: "PSI Meter / PERsiST memory line; commercial private source",
  },
  {
    id: "persist",
    tool: "spl_persist",
    ops: ["card"],
    page: SITE + "/persist",
    note: "Alias surface for PSI persist host docs",
  },
  {
    id: "gitdepot",
    tool: "spl_gitdepot",
    ops: ["receipt", "quote", "publish", "retrieve", "list", "card"],
    page: SITE + "/gitdepot",
    note: "Depot receipts offline; publish/retrieve need GITDEPOT_URL + GITDEPOT_KEY",
  },
  {
    id: "conductor",
    tool: "spl_conductor",
    ops: ["intent", "list", "get", "push", "review", "approve", "reject", "diff_stat", "card"],
    page: SITE + "/api/conductor",
    note: "Offline task + review; live CuNi prove needs cuni binary",
  },
  {
    id: "quikgater",
    tool: "spl_quikgater",
    ops: ["fetch", "card"],
    page: SITE + "/quikgater",
    note: "Pay-per-fetch worker",
  },
  {
    id: "exactodds",
    tool: "spl_exactodds",
    ops: ["draw", "resolve", "card"],
    page: SITE + "/exactodds",
    note: "Deterministic draw/resolve (local lib)",
  },
  {
    id: "awlpay",
    tool: "spl_awlpay",
    ops: ["quote", "card"],
    page: SITE + "/awlpay",
    note: "Fee quote shape; settlement stays on payment rails",
  },
  {
    id: "pulsar",
    tool: "spl_pulsar",
    ops: ["encode", "decode", "card"],
    page: SITE + "/pulsar",
    note: "Local pulsar binary when PULSAR_BIN or bin/pulsar is present",
  },
  {
    id: "agenthq",
    tool: "spl_agenthq",
    ops: ["validate_slug", "card"],
    page: SITE + "/hq",
    note: "HQ slug rules; paid claim is upstream",
  },
  {
    id: "teachaid",
    tool: "spl_teachaid",
    ops: ["card"],
    page: SITE + "/teachaid",
    note: "TeachAid product card",
  },
  {
    id: "labpass",
    tool: "spl_labpass",
    ops: ["card"],
    page: SITE + "/lab-pass",
    note: "Seat bundle SKU card",
  },
  {
    id: "trugame",
    tool: "spl_trugame",
    ops: ["card"],
    page: SITE + "/trugame",
    note: "TRUgame scene card; SKU may be undecided",
  },
  {
    id: "tollkeeper",
    tool: "spl_tollkeeper",
    ops: ["list", "card"],
    page: SITE + "/rider",
    note: "Rider toll tools — call pcc-compress, exactodds-draw, chamber-seal, …",
  },
  {
    id: "arn_mcp",
    tool: "spl_products",
    ops: ["list"],
    page: SITE + "/mcp",
    note: "Meta: list every product MCP door (ArN host)",
  },
]);

function productIndex() {
  return LAB_PRODUCTS.map((p) => ({
    id: p.id,
    tool: p.tool,
    ops: p.ops.slice(),
    page: p.page,
    note: p.note,
  }));
}

function cardFor(product, extra = {}) {
  const hit = LAB_PRODUCTS.find((p) => p.id === product);
  return {
    ok: true,
    product,
    tool: hit?.tool || null,
    ops: hit?.ops?.slice() || [],
    page: hit?.page || SITE,
    note: hit?.note || "",
    pay: SITE + "/pay",
    catalog: SITE + "/api/x402-products",
    mcp: SITE + "/mcp",
    ...extra,
  };
}

function depotClient(args = {}) {
  const endpoint = text(args.endpoint || process.env.GITDEPOT_URL || process.env.GITDEPOT_HUB || "");
  const key = text(args.key || process.env.GITDEPOT_KEY || "");
  return createDepotStore({ endpoint, key });
}

async function callGitdepot(op, args) {
  if (op === "card") {
    return cardFor("gitdepot", {
      free_bytes: DEPOT_FREE_BYTES,
      ops_receipt: DEPOT_OPS.slice(),
      hub: text(process.env.GITDEPOT_URL) || "https://gitdepot-hub.fly.dev",
      live_adapter: Boolean(text(process.env.GITDEPOT_URL) && text(process.env.GITDEPOT_KEY)),
    });
  }
  if (op === "quote") {
    const bytes = Number(args.bytes);
    if (!Number.isSafeInteger(bytes) || bytes < 0) return { ok: false, error: "bad_bytes" };
    return {
      ok: true,
      product: "gitdepot",
      bytes,
      free_bytes: DEPOT_FREE_BYTES,
      quoted_cents: defaultDepotPrice(bytes),
      note: "Offline overage quote; free through 10 GB pooled tier in receipt law",
    };
  }
  if (op === "receipt") {
    const receipt = buildDepotReceipt({
      op: text(args.receipt_op || args.depot_op || "publish"),
      team: text(args.team || "lab"),
      sha256: text(args.sha256).toLowerCase(),
      bytes: Number(args.bytes),
    });
    if (!receipt) return { ok: false, error: "bad_receipt_input" };
    return { ok: true, receipt };
  }
  if (op === "publish") {
    const store = depotClient(args);
    const out = await store.publish({
      name: args.name,
      blob_b64: args.blob_b64 || args.data_b64,
      bytes: args.bytes,
      sha256: args.sha256,
      size: args.size,
      provenance: args.provenance,
    });
    return out;
  }
  if (op === "retrieve") {
    const store = depotClient(args);
    const out = await store.retrieve(args.sha256);
    if (out.ok && Buffer.isBuffer(out.bytes)) {
      return {
        ok: true,
        sha256: out.sha256,
        size: out.size,
        blob_b64: out.bytes.toString("base64"),
      };
    }
    return out;
  }
  if (op === "list") {
    return depotClient(args).list();
  }
  return { ok: false, error: "unknown_op", ops: ["card", "quote", "receipt", "publish", "retrieve", "list"] };
}

async function callConductor(op, args) {
  if (op === "card") return cardFor("conductor");
  if (op === "intent") return intentTask(args);
  if (op === "list") return { ok: true, tasks: listTasks() };
  if (op === "get") return getTask(args.task_id || args.id);
  if (op === "push") return pushTask(args.task_id || args.id, args.detail || args);
  if (op === "review") {
    if (args.diff != null || args.files != null) return reviewChanges(args);
    return reviewTask(args.task_id || args.id, args);
  }
  if (op === "approve") return approveTask(args.task_id || args.id, args.detail || args);
  if (op === "reject") return rejectTask(args.task_id || args.id, args);
  if (op === "diff_stat") return { ok: true, ...diffStat(args.diff || "") };
  return { ok: false, error: "unknown_op" };
}

async function callChamber(op, args) {
  if (op === "card") return cardFor("chamber", { seats: ["chamber-month", "chamber-year"] });
  if (op === "seal") {
    let obj = args.obj != null ? args.obj : args.payload;
    if (typeof obj === "string") {
      try {
        obj = JSON.parse(obj);
      } catch {
        return { ok: false, error: "seal_refused" };
      }
    }
    const envelope = sealEnvelope(obj, {
      keyHex: String(args.key_hex || args.keyHex || ""),
      keyHex2: args.key_hex2 || args.keyHex2 || undefined,
    });
    if (!envelope) return { ok: false, error: "seal_refused" };
    return { ok: true, envelope };
  }
  if (op === "open") {
    return openEnvelope(args.envelope, {
      keyHex: String(args.key_hex || args.keyHex || ""),
      keyHex2: args.key_hex2 || args.keyHex2 || undefined,
    });
  }
  return { ok: false, error: "unknown_op" };
}

async function callTrustream(op, args) {
  if (op === "card") return cardFor("trustream", { tile: 4096, magic: "TS01" });
  if (op === "pack") {
    const raw = b64ToBuf(args.data_b64 || args.blob_b64);
    const packed = encodeTrustream(raw);
    return {
      ok: true,
      packed_b64: packed.toString("base64"),
      raw_bytes: raw.length,
      packed_bytes: packed.length,
      sha256: sha256hex(raw),
    };
  }
  if (op === "unpack") {
    try {
      const packed = b64ToBuf(args.packed_b64 || args.blob_b64);
      const raw = decodeTrustream(packed);
      return { ok: true, data_b64: raw.toString("base64"), raw_bytes: raw.length, sha256: sha256hex(raw) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }
  return { ok: false, error: "unknown_op" };
}

async function callExactodds(op, args) {
  if (op === "card") return cardFor("exactodds", { toll: { draw: "0.01", resolve: "0.02" } });
  if (op === "draw") {
    const outcomes = Array.isArray(args.outcomes) ? args.outcomes : ["heads", "tails"];
    return exactDraw(args.seed ?? args.draw_id ?? "0", outcomes);
  }
  if (op === "resolve") {
    const drawn = args.drawn || exactDraw(args.seed ?? "0", Array.isArray(args.outcomes) ? args.outcomes : ["heads", "tails"]);
    return exactResolve(drawn, args.outcome);
  }
  return { ok: false, error: "unknown_op" };
}

async function callAwlpay(op, args) {
  if (op === "card") {
    return cardFor("awlpay", {
      published: { rate: "0.5%", seat_month: 39, seat_year: 799 },
      note: "Quote is informational; rails settle elsewhere",
    });
  }
  if (op === "quote") {
    const amount = Number(args.amount_usd ?? args.usd);
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "bad_amount" };
    const fee = Math.round(amount * 0.005 * 1e6) / 1e6;
    return {
      ok: true,
      product: "awlpay",
      amount_usd: amount,
      fee_usd: fee,
      rate: 0.005,
      rail: text(args.rail) || "x402",
    };
  }
  return { ok: false, error: "unknown_op" };
}

async function callPulsar(op, args) {
  if (op === "card") {
    return cardFor("pulsar", { bin: pulsarBin(), license: "GPL-3.0-or-later host binary" });
  }
  try {
    if (op === "encode") {
      const raw = b64ToBuf(args.data_b64);
      const out = await pulsarEncode(raw);
      if (out == null) return { ok: false, error: "not_compressible" };
      return { ok: true, packed_b64: out.toString("base64"), packed_bytes: out.length, raw_bytes: raw.length };
    }
    if (op === "decode") {
      const packed = b64ToBuf(args.packed_b64);
      const raw = await pulsarDecode(packed);
      return { ok: true, data_b64: raw.toString("base64"), raw_bytes: raw.length };
    }
  } catch (e) {
    return { ok: false, error: "pulsar_unavailable", detail: String(e.message || e).slice(0, 240) };
  }
  return { ok: false, error: "unknown_op" };
}

async function callPcc(op, args, req, deps) {
  if (op === "card") {
    return cardFor("pcc", {
      free: "first 1 GB once per address (lifetime)",
      after: "$0.05/GB suite after-rate on pps; compress door may differ — use spl_quote",
    });
  }
  if (op === "quote") {
    return computeQuote({
      product: args.product || "auto",
      dataClass: args.dataClass || args.data_class || "unknown",
      op: args.compress_op || args.meter_op || "compress",
      bytes: args.bytes || 0,
    });
  }
  if (op === "compress" && deps?.compress) return deps.compress(args, req);
  if (op === "decompress" && deps?.decompress) return deps.decompress(args, req);
  if (op === "compress" || op === "decompress") {
    return {
      ok: false,
      error: "use_alias",
      alias: op === "compress" ? "spl_compress" : "spl_decompress",
      note: "Call spl_compress / spl_decompress (or compress / decompress) for the hosted engine",
    };
  }
  return { ok: false, error: "unknown_op" };
}

export const PRODUCT_TOOLS = Object.freeze([
  tool(
    "spl_products",
    "List every Slid Phi Labs product that has an MCP call door, with tool name, ops, page, and note. Read-only. Use before spl_product_call or a per-product spl_* tool.",
    {},
    [],
  ),
  tool(
    "spl_product_call",
    "Call any lab product by id + op through one door. Args: product (required), op (required), plus op-specific fields. Fail-closed when the product or op is unknown or a live adapter is missing.",
    {
      product: { type: "string", description: "Product id from spl_products (e.g. gitdepot, psi, conductor)." },
      op: { type: "string", description: "Operation for that product (e.g. card, receipt, draw)." },
    },
    ["product", "op"],
  ),
  tool("spl_arn", "ArN product door (Agent Commerce Network). op=card. Alias: spl_acn.", { op: opProp(["card"]) }, ["op"]),
  tool("spl_acn", "Alias for spl_arn (ArN). Prefer spl_arn.", { op: opProp(["card"]) }, ["op"]),
  tool("spl_acp", "AcP product door (Agent Commerce Protocol). op=layers|card.", { op: opProp(["layers", "card"]) }, ["op"]),
  tool("spl_rider", "Rider product door. op=card. Issue/verify live on Agent-Rider; warrants use spl_warrant_*.", { op: opProp(["card"]) }, ["op"]),
  tool("spl_warrant", "Warrant product door. op=card. Runtime: spl_warrant_issue/verify/reserve/release/receipt.", { op: opProp(["card"]) }, ["op"]),
  tool(
    "spl_chamber",
    "Chamber product door. op=seal|open|card. seal needs obj + key_hex; open needs envelope + key_hex.",
    {
      op: opProp(["seal", "open", "card"]),
      obj: { type: "object" },
      envelope: { type: "object" },
      key_hex: { type: "string" },
      key_hex2: { type: "string" },
    },
    ["op"],
  ),
  tool(
    "spl_pcc",
    "PCC product door. op=quote|card|compress|decompress. compress/decompress alias to spl_compress/spl_decompress.",
    {
      op: opProp(["quote", "card", "compress", "decompress"]),
      bytes: { type: "number" },
      data_b64: { type: "string" },
      packed_b64: { type: "string" },
    },
    ["op"],
  ),
  tool(
    "spl_trustream",
    "TRUSTREAM product door. op=pack|unpack|card. pack/unpack use data_b64 / packed_b64.",
    {
      op: opProp(["pack", "unpack", "card"]),
      data_b64: { type: "string" },
      packed_b64: { type: "string" },
    },
    ["op"],
  ),
  tool("spl_cuni", "CuNi product door. op=card. Runtime verbs: translate, check, audit, cuni_bank, …", { op: opProp(["card"]) }, ["op"]),
  tool(
    "spl_psi",
    "PSI / Meter product door. op=card|seats. Source is commercial/private; seats via psi-meter SKUs.",
    { op: opProp(["card", "seats"]) },
    ["op"],
  ),
  tool("spl_persist", "PERsiST page door. op=card. Same seat story as spl_psi.", { op: opProp(["card"]) }, ["op"]),
  tool(
    "spl_gitdepot",
    "GitDepot product door. op=card|quote|receipt|publish|retrieve|list. Live publish/retrieve need GITDEPOT_URL + GITDEPOT_KEY (or endpoint/key args).",
    {
      op: opProp(["card", "quote", "receipt", "publish", "retrieve", "list"]),
      bytes: { type: "number" },
      team: { type: "string" },
      sha256: { type: "string" },
      name: { type: "string" },
      blob_b64: { type: "string" },
      data_b64: { type: "string" },
      receipt_op: { type: "string", description: "publish | evict | join for receipt op" },
      endpoint: { type: "string" },
      key: { type: "string" },
    },
    ["op"],
  ),
  tool(
    "spl_conductor",
    "Conductor product door. op=intent|list|get|push|review|approve|reject|diff_stat|card. Offline in-memory by default.",
    {
      op: opProp(["intent", "list", "get", "push", "review", "approve", "reject", "diff_stat", "card"]),
      task_id: { type: "string" },
      title: { type: "string" },
      diff: { type: "string" },
    },
    ["op"],
  ),
  tool(
    "spl_quikgater",
    "Quikgater product door. op=fetch|card. fetch needs url.",
    { op: opProp(["fetch", "card"]), url: { type: "string" } },
    ["op"],
  ),
  tool(
    "spl_exactodds",
    "ExactOdds product door. op=draw|resolve|card. Local deterministic lib (no Rider required).",
    {
      op: opProp(["draw", "resolve", "card"]),
      seed: { type: "string" },
      outcomes: { type: "array", items: { type: "string" } },
      outcome: { type: "string" },
      drawn: { type: "object" },
    },
    ["op"],
  ),
  tool(
    "spl_awlpay",
    "AwLPay product door. op=quote|card. quote needs amount_usd.",
    { op: opProp(["quote", "card"]), amount_usd: { type: "number" }, rail: { type: "string" } },
    ["op"],
  ),
  tool(
    "spl_pulsar",
    "Pulsar product door. op=encode|decode|card. Needs local pulsar binary.",
    {
      op: opProp(["encode", "decode", "card"]),
      data_b64: { type: "string" },
      packed_b64: { type: "string" },
    },
    ["op"],
  ),
  tool(
    "spl_agenthq",
    "AgentHQ product door. op=validate_slug|card.",
    { op: opProp(["validate_slug", "card"]), slug: { type: "string" }, name: { type: "string" } },
    ["op"],
  ),
  tool("spl_teachaid", "TeachAid product door. op=card.", { op: opProp(["card"]) }, ["op"]),
  tool("spl_labpass", "Lab Pass product door. op=card.", { op: opProp(["card"]) }, ["op"]),
  tool("spl_trugame", "TRUgame product door. op=card.", { op: opProp(["card"]) }, ["op"]),
  tool(
    "spl_tollkeeper",
    "Tollkeeper product door. op=list|card. Lists Rider toll tool names and published flat USD where set.",
    { op: opProp(["list", "card"]) },
    ["op"],
  ),
]);

const PRODUCT_TOOL_NAMES = new Set(PRODUCT_TOOLS.map((t) => t.name));

export function isProductTool(name) {
  return PRODUCT_TOOL_NAMES.has(name);
}

/**
 * Dispatch a product tool. deps may inject compress/decompress handlers
 * from mcp.js so PCC ops reuse the hosted encoder without circular imports.
 */
export async function dispatchProductTool(name, args = {}, req = null, deps = {}) {
  if (name === "spl_products") {
    return {
      ok: true,
      version: PRODUCT_MCP_VERSION,
      count: LAB_PRODUCTS.length,
      products: productIndex(),
    };
  }

  let product = null;
  let op = text(args.op);

  if (name === "spl_product_call") {
    product = text(args.product).toLowerCase();
    op = text(args.op).toLowerCase();
  } else if (name.startsWith("spl_")) {
    product = name.slice(4);
    op = op.toLowerCase();
  }

  if (!product || !op) return { ok: false, error: "missing_product_or_op" };

  // normalize aliases
  if (product === "lab_pass") product = "labpass";
  if (product === "agent_hq") product = "agenthq";
  if (product === "git_depot") product = "gitdepot";
  if (product === "exact_odds") product = "exactodds";
  if (product === "tru_game") product = "trugame";
  if (product === "arn_mcp" || product === "acn_mcp") product = "arn";
  if (product === "acn") product = "arn";

  switch (product) {
    case "products":
      return dispatchProductTool("spl_products", {}, req, deps);
    case "arn":
      if (op === "card") {
        return cardFor("arn", {
          brand: "ArN",
          endpoint: SITE + "/mcp",
          version: "streamable-http",
          note: "ArN (not ACN)",
        });
      }
      break;
    case "acp":
      if (op === "card") {
        return cardFor("acp", {
          brand: "AcP",
          layers: ACP_LAYERS.length,
          missing: missingAcpLayers(),
          note: "AcP (not ACP)",
        });
      }
      if (op === "layers") {
        return {
          ok: true,
          brand: "AcP",
          layers: ACP_LAYERS.map(([id, path]) => ({ id, path })),
          missing: missingAcpLayers(),
        };
      }
      break;
    case "rider":
      if (op === "card") {
        return cardFor("rider", {
          host: process.env.RIDER_URL || "https://spl-agentrider.fly.dev",
          related_tools: ["spl_warrant_issue", "spl_agentic_plan", "spl_agentic_run"],
        });
      }
      break;
    case "warrant":
      if (op === "card") {
        return cardFor("warrant", {
          tools: [
            "spl_warrant_issue",
            "spl_warrant_verify",
            "spl_warrant_reserve",
            "spl_warrant_release",
            "spl_warrant_receipt",
          ],
        });
      }
      break;
    case "chamber":
      return callChamber(op, args);
    case "pcc":
      return callPcc(op, args, req, deps);
    case "trustream":
      return callTrustream(op, args);
    case "cuni":
      if (op === "card") {
        return cardFor("cuni", {
          tools: ["cuni_bank", "translate", "check", "audit", "ingest", "money", "time", "chain", "ship", "parity"],
          studio: "https://spl-cuni-studio.fly.dev/",
        });
      }
      break;
    case "psi":
      if (op === "card" || op === "seats") {
        return cardFor("psi", {
          seats: {
            "psi-meter": { usd: 25, period: "month", pay: SITE + "/pay?sku=psi-meter" },
            "psi-meter-year": { usd: 250, period: "year", pay: SITE + "/pay?sku=psi-meter-year" },
          },
          source: "private commercial — https://github.com/Slid-Phi-Labs/psi (private)",
          interlink: "local mesh under ~/.psi/a2a — not exposed on this MCP host",
        });
      }
      break;
    case "persist":
      if (op === "card") return cardFor("persist", { alias_of: "psi", tool: "spl_psi" });
      break;
    case "gitdepot":
      return callGitdepot(op, args);
    case "conductor":
      return callConductor(op, args);
    case "quikgater":
      if (op === "card") return cardFor("quikgater", { price: "$0.02/fetch, first 100/mo free" });
      if (op === "fetch") return dispatchFetch(args);
      break;
    case "exactodds":
      return callExactodds(op, args);
    case "awlpay":
      return callAwlpay(op, args);
    case "pulsar":
      return callPulsar(op, args);
    case "agenthq":
      if (op === "card") return cardFor("agenthq", { path: SITE + "/hq" });
      if (op === "validate_slug") return validateSlug(args.slug || args.name);
      break;
    case "teachaid":
      if (op === "card") return cardFor("teachaid", { fly: "teachaid (historical)" });
      break;
    case "labpass":
      if (op === "card") {
        return cardFor("labpass", {
          note: "Bundle seat — buy via /pay and catalog; includes product doors per grant",
        });
      }
      break;
    case "trugame":
      if (op === "card") return cardFor("trugame", { sku: "undecided — see catalog" });
      break;
    case "tollkeeper":
      if (op === "card" || op === "list") {
        return cardFor("tollkeeper", {
          tools: [
            "pcc-compress",
            "pcc-verify",
            "attest-notarize",
            "attest-exactness",
            "exactodds-draw",
            "exactodds-resolve",
            "cuni-proof",
            "trustream-pack",
            "chamber-seal",
            "awlpay-quote",
          ],
        });
      }
      break;
    default:
      return { ok: false, error: "unknown_product", product, hint: "Call spl_products" };
  }

  return { ok: false, error: "unknown_op", product, op };
}
