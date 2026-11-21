import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const server = http.createServer((req, res) => {
  if (req.url === "/receipts.json") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(readJsonDir(path.join(root, "receipts"))));
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
