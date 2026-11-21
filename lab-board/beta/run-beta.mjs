import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spl-beta-"));
process.env.WARRANT_DIR = dir;
process.env.WARRANT_SECRET = "beta-secret-not-a-production-key";
const warrant = await import(pathToFileURL(path.resolve("docs/site/api/lib/warrant.mjs")).href);

const seats = ["seat-a", "seat-b", "seat-c"];
const results = [];

for (const seat of seats) {
  const issued = warrant.issueWarrant({
    demo: true,
    max_usd: 1,
    max_calls: 10,
    ttl_seconds: 900,
  });
  assert.equal(issued.ok, true, seat);
  let refused = null;
  for (let i = 0; i < 6; i++) {
    const row = warrant.reserveWarrant({
      token: issued.token,
      host: "www.slidphilabs.com",
      action: "invoke",
      usd: 0.2,
      idempotency_key: `${seat}-${i}`,
    });
    if (!row.ok) refused = row.reason;
  }
  const again = warrant.reserveWarrant({
    token: issued.token,
    host: "www.slidphilabs.com",
    action: "invoke",
    usd: 0.2,
    idempotency_key: `${seat}-0`,
  });
  results.push({
    seat,
    sixth_reason: refused,
    retry_same_reservation: again.idempotent === true,
  });
}

const pass = results.every((row) => row.sixth_reason === "usd_exhausted" && row.retry_same_reservation);
const decision = {
  ran_at: new Date().toISOString(),
  seats: results,
  decision: pass ? "go" : "change",
  note: "Three lab seats ran the warrant path on this machine. No outside team was emailed.",
};
const out = path.resolve("lab-board/beta/decision.json");
fs.writeFileSync(out, JSON.stringify(decision, null, 2));
console.log(decision.decision, out);
if (!pass) process.exit(1);
