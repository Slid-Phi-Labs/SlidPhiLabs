import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANES, CREW, loadLanes, claim, release, done } from "./lanes.mjs";

const LANES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "data",
);

const root = path.resolve("data/warrant");
const clerk = Boolean(process.env.CLERK_SECRET_KEY);

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function page(dir = root) {
  const warrants = readJsonDir(path.join(dir, "warrants"));
  const receipts = readJsonDir(path.join(dir, "receipts"));
  const spent = receipts.reduce((sum, row) => sum + (Number(row.usd) || 0), 0);
  const bars = warrants.slice(0, 8).map((row) => {
    const used = Math.max(0, (row.max_usd || 0) - (row.remaining_usd || 0));
    const width = Math.min(240, Math.round(used * 40));
    return `<div>${row.agent_id || row.id} <span style="display:inline-block;background:#14365c;height:12px;width:${width}px"></span> ${used}</div>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><title>Lab dashboard</title>
  <h1>Agents and spend</h1>
  <p>Clerk: ${clerk ? "key present" : "not configured, lab mode"}.</p>
  <p>${warrants.length} warrants, ${receipts.length} receipts, ${spent} usd on receipts.</p>
  <h2>Spend</h2>${bars || "<p>No warrants on disk.</p>"}
  <p><a href="/receipts.json">Download receipts</a></p>`;
}

function laneCard(board, lane) {
  const side = board[lane];
  const head = side.holder ? `${lane} — ${side.holder}` : `${lane} — open seat`;
  const items = side.items.map((row) => {
    const link = row.url ? ` <a href="${row.url}">#${row.id}</a>` : ` ${row.id}`;
    return `<li>${row.title} (${row.holder})${link}
      <form method="post" action="/lanes/release" style="display:inline">
      <input type="hidden" name="id" value="${row.id}">
      <button>release</button></form>
      <form method="post" action="/lanes/done" style="display:inline">
      <input type="hidden" name="id" value="${row.id}">
      <button>done</button></form></li>`;
  }).join("");
  return `<td valign="top" width="25%"><h2>${head}</h2><ul>${items || "<li><i>empty</i></li>"}</ul></td>`;
}

function lanesPage() {
  const board = loadLanes(LANES_DIR);
  const open = board.open.map((row) => {
    const link = row.url ? ` <a href="${row.url}">link</a>` : "";
    const lanes = LANES.map((l) =>
      `<option value="${l}">${l}</option>`).join("");
    return `<li><b>${row.id}</b> ${row.text || row.title} [${row.source}]${link}
      <form method="post" action="/lanes/claim" style="display:inline">
      <input type="hidden" name="id" value="${row.id}">
      <select name="lane">${lanes}</select>
      <select name="by">${CREW.map((c) => `<option>${c}</option>`).join("")}</select>
      <button>claim</button></form></li>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><title>Lab lanes</title>
  <h1>L &middot; OPEN &middot; R</h1>
  <p>Center items are unowned. Claim one into a lane to take it; first
  claim on an empty lane seats that lane. Never touch another lane's items.</p>
  <table width="100%"><tr>${laneCard(board, "L")}
  <td valign="top" width="50%"><h2>OPEN (${board.open.length})</h2><ul>${open || "<li><i>clear</i></li>"}</ul></td>
  ${laneCard(board, "R")}</tr></table>`;
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = "";
    req.on("data", (c) => { s += c; });
    req.on("end", () => {
      const type = req.headers["content-type"] || "";
      if (type.includes("json")) {
        try { resolve(JSON.parse(s || "{}")); return; } catch { resolve({}); return; }
      }
      resolve(Object.fromEntries(new URLSearchParams(s)));
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/receipts.json") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(readJsonDir(path.join(root, "receipts"))));
    return;
  }
  if (url === "/lanes" || url === "/lanes.json") {
    const board = loadLanes(LANES_DIR);
    if (url === "/lanes.json" || (req.headers.accept || "").includes("json")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(board));
      return;
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(lanesPage());
    return;
  }
  if (req.method === "POST" && url.startsWith("/lanes/")) {
    const body = await readBody(req);
    const op = url === "/lanes/claim"
      ? claim(LANES_DIR, body.id, body.lane, body.by)
      : url === "/lanes/release"
        ? release(LANES_DIR, body.id)
        : url === "/lanes/done"
          ? done(LANES_DIR, body.id, body.by)
          : { ok: false, reason: "bad_op" };
    if ((req.headers["content-type"] || "").includes("json")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(op));
      return;
    }
    res.writeHead(303, { location: "/lanes" });
    res.end();
    return;
  }
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(page());
});

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  server.listen(4317, () => console.log("dashboard http://127.0.0.1:4317"));
}

export { page };
