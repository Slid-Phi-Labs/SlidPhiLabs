// check-prices.mjs — canonical-price guard for the live site (docs/site/).
//
// Node stdlib only. Run: `node docs/site/scripts/check-prices.mjs` (exit 0 = pass).
// What it checks:
//   1. Every canonical figure string appears in its expected live page(s).
//      teachaid.html is EXCLUDED for price (disputed TeachAid tier question).
//      Toll 5 is asserted at $0.05 (ruled by the owner Nov 28, 2026).
//   2. pricing.json math keys hold the canonical values, and the disputed
//      object lists exactly the two blocked items.
//   3. assets/pricing-data.mjs still deep-equals pricing.json (hand-sync).
//   4. NEW 2026-11-22 (diligence): Rider annual prices on /pricing, the
//      Merchant Gate pointer, the homepage card periods, the Lab Pass parts
//      arithmetic, the Rider Ops standalone SKUs, the uniform 10x annual
//      rule, and the Agent Rider Network name on the three pages touched
//      (pricing.html, products.html, index.html). Header names such as
//      X-Agent-Rider are NOT renamed and are excluded from the name check.
//   5. No known stale pattern appears in docs/site/ HTML, except:
//      - docs/site/blog/ (dated archive posts; the $369 Chamber-year anchor
//        was still fixed there, but post bodies keep their history), and
//      - docs/site/assets/web-samples/ (sample fixtures, not live pages).
//      The two disputed items are not stale patterns and are never asserted.
// If this fails, fix the PAGES (or pricing.json), not the script — unless the
// failure is one of the two disputed items, which this script already excludes.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const notes = [];

function read(rel) {
  return readFileSync(join(SITE, rel), "utf8");
}

function expect(page, needle, label) {
  const text = read(page);
  if (!text.includes(needle)) {
    failures.push(`${page}: missing canonical figure (${label}): ${JSON.stringify(needle)}`);
  }
}

// ---------------------------------------------------------------- 1. canonical figures on live pages
const EXPECT = [
  // pricing.html — the human-readable canonical page
  ["pricing.html", "$0.25 / GB", "PCC meter"],
  ["pricing.html", "$25 / month", "PCC Pro month"],
  ["pricing.html", "$250 / year", "PCC Pro year"],
  ["pricing.html", "$20 / mo", "Chamber month"],
  ["pricing.html", "$200 / yr", "Chamber year"],
  ["pricing.html", "Solo $12", "Rider Solo"],
  ["pricing.html", "Team $49", "Rider Team"],
  ["pricing.html", "Fleet $199", "Rider Fleet"],
  ["pricing.html", "$495 / yr", "Lab Pass year"],
  ["pricing.html", "$369 / yr grant", "TNSSRC grant"],
  ["pricing.html", "$25/seat/month", "PSI Meter seat"],
  ["pricing.html", "$79 / month", "PSI Org"],
  // NEW 2026-11-22: Rider annuals + Merchant Gate pointer on /pricing
  ["pricing.html", "Solo $120/yr", "Rider Solo year"],
  ["pricing.html", "Team $490/yr", "Rider Team year"],
  ["pricing.html", "Fleet $1,990/yr", "Rider Fleet year"],
  ["pricing.html", "$120 – $1,990 / yr", "Rider annual range"],
  ["pricing.html", "$80 / yr", "Warrant add-on year"],
  ["pricing.html", "Merchant Gate", "Merchant Gate pointer"],
  ["pricing.html", "$11.99/mo", "Merchant Gate price"],
  ["pricing.html", "2× plan price", "Rider cap wording"],
  // index.html — homepage cards
  ["index.html", "Solo $12/mo · Team $49/mo · Fleet $199/mo", "Rider card"],
  ["index.html", "$20/mo · $200/yr", "Chamber card"],
  ["index.html", "The parts sum to $650. The pass is $495.", "Lab Pass card"],
  ["index.html", "check $0.05, translate $0.10, audit $1.00", "CuNi calls"],
  ["index.html", "$0.25 per GB", "PCC meter"],
  ["index.html", "Pro is $25 a month for 100 GB", "PCC Pro"],
  // chamber.html
  ["chamber.html", "$20/mo · $200/yr", "Chamber price"],
  ["chamber.html", "24-hour try", "Chamber try"],
  ["chamber.html", "free forever", "Chamber open policy"],
  // rider.html
  ["rider.html", "$12 / mo", "Rider Solo month"],
  ["rider.html", "$120/year", "Rider Solo year"],
  ["rider.html", "$49 / mo", "Rider Team month"],
  ["rider.html", "$490/year", "Rider Team year"],
  ["rider.html", "$199 / mo", "Rider Fleet month"],
  ["rider.html", "$1,990/year", "Rider Fleet year"],
  // warrant.html
  ["warrant.html", "$8/month add-on to Rider Solo ($80/year)", "Warrant add-on"],
  // lab-pass.html — composition verbatim from the live page
  ["lab-pass.html", "Lab Pass $495/year: Chamber (1 year) + Rider Solo (1 year) + PSI Meter 1 seat (1 year) + Warrant add-on (1 year)", "Lab Pass composition"],
  ["lab-pass.html", "Parts sum $650; the bundle is $495 (24% off)", "Lab Pass parts sum"],
  // tollkeeper.html — Toll 5 at the ruled $0.05; attest-exactness tool excluded too
  ["tollkeeper.html", "$0.005 <span class=\"spl-note\">per check · 100/mo free</span>", "Toll 1 identity"],
  ["tollkeeper.html", "$0.02 <span class=\"spl-note\">per lookup · listing free</span>", "Toll 2 lookup"],
  ["tollkeeper.html", "1% <span class=\"spl-note\">escrow routing</span>", "Toll 3 escrow"],
  ["tollkeeper.html", "$0.01 <span class=\"spl-note\">issue · $0.005 check</span>", "Toll 4 grant"],
  ["tollkeeper.html", "$0.05 <span class=\"spl-note\">per check</span>", "Toll 5 exactness"],
  ["tollkeeper.html", "1% <span class=\"spl-note\">at stake</span>", "Toll 6 bond"],
  ["tollkeeper.html", "$0.02 <span class=\"spl-note\">hosted transfer · format free</span>", "Toll 7 memory transfer"],
  ["tollkeeper.html", "$0.01 <span class=\"spl-note\">per MB in</span>", "tool pcc-compress / trustream-pack"],
  ["tollkeeper.html", "$0.02 <span class=\"spl-note\">per check</span>", "tool pcc-verify"],
  ["tollkeeper.html", "$0.01 <span class=\"spl-note\">per notarization</span>", "tool attest-notarize"],
  ["tollkeeper.html", "$0.01 <span class=\"spl-note\">per draw</span>", "tool exactodds-draw"],
  ["tollkeeper.html", "$0.02 <span class=\"spl-note\">per resolution</span>", "tool exactodds-resolve"],
  ["tollkeeper.html", "$0.10 <span class=\"spl-note\">per proof</span>", "tool cuni-proof"],
  ["tollkeeper.html", "$0.02 <span class=\"spl-note\">per seal</span>", "tool chamber-seal"],
  ["tollkeeper.html", "$0.005 <span class=\"spl-note\">per quote</span>", "tool awlpay-quote"],
  // quikgater.html
  ["quikgater.html", "$0.02 per fetch", "Quikgater fetch"],
  ["quikgater.html", "First 100 fetches/month free", "Quikgater free"],
  ["quikgater.html", "default $10", "Quikgater cap"],
  // cuni.html
  ["cuni.html", "Closed-app $490/yr", "CuNi closed-app grant"],
  ["cuni.html", "$0.05 per check", "CuNi per-check"],
  ["cuni.html", "Studio free", "CuNi Studio"],
  // teachaid.html is EXCLUDED for price (disputed tier question — see pricing.json disputed).
];
for (const [page, needle, label] of EXPECT) expect(page, needle, label);

// ---------------------------------------------------------------- 2. pricing.json math + disputed
const pricing = JSON.parse(read("pricing.json"));
const MATH_EXPECT = {
  chamber_month: 20, chamber_year: 200,
  pcc_meter_gb: 0.25, pcc_pro_month: 25, pcc_pro_year: 250, pcc_pro_overage_gb: 0.2,
  rider_solo: 12, rider_team: 49, rider_fleet: 199,
  rider_solo_year: 120, rider_team_year: 490, rider_fleet_year: 1990,
  rider_ops_month: 37, rider_ops_year: 369,
  warrant_addon: 8, warrant_addon_year: 80,
  lab_pass_year: 495, lab_pass_parts_sum: 650,
  quikgater_fetch: 0.02,
  cuni_check: 0.05, cuni_translate: 0.1, cuni_ingest: 0.1, cuni_money: 0.25,
  cuni_time: 0.25, cuni_parity: 0.25, cuni_chain: 0.5, cuni_ship: 0.5,
  cuni_audit: 1, cuni_squeeze: 0.1, cuni_exception_year: 490,
  tnssrc_grant_year: 369, tnssrc_bakeoff_month: 19.31,
  pulsar_embed_year: 490, pulsar_binary: 0,
  psi_meter_seat: 25, psi_meter_year: 250, psi_org: 79,
  gitdepot_seat: 15, gitdepot_seat_year: 150,
  acp: undefined, // acp cert lives in products.acp.certification, not math
  consulting_hour: 175, oss_support_year: 199,
  grant_year: 490, grant_founding: 190, grant_3plus: 390,
  teachaid_student: 6, teachaid_student_year: 60, teachaid_pilot: 2500,
  tollkeeper_identity: 0.005, tollkeeper_lookup: 0.02, tollkeeper_promote: 9,
  tollkeeper_escrow_pct: 1, tollkeeper_grant_issue: 0.01, tollkeeper_grant_check: 0.005,
  tollkeeper_toll_5_exactness: 0.05,
  tollkeeper_bond_pct: 1, tollkeeper_memory_transfer: 0.02,
  tollkeeper_pcc_compress: 0.01, tollkeeper_pcc_verify: 0.02,
  tollkeeper_attest_notarize: 0.01, tollkeeper_exactodds_draw: 0.01,
  tollkeeper_exactodds_resolve: 0.02, tollkeeper_cuni_proof: 0.1,
  tollkeeper_trustream_pack: 0.01, tollkeeper_chamber_seal: 0.02,
  tollkeeper_awlpay_quote: 0.005,
  awlpay_free_pct: 0.5, awlpay_pro: 39, awlpay_l33t: 799, awlpay_min_send: 1,
};
for (const [key, value] of Object.entries(MATH_EXPECT)) {
  if (value === undefined) continue;
  if (pricing.math[key] !== value) {
    failures.push(`pricing.json math.${key}: expected ${value}, got ${pricing.math[key]}`);
  }
}
if (pricing.products?.acp?.certification?.usd !== 990) {
  failures.push(`pricing.json products.acp.certification.usd: expected 990, got ${pricing.products?.acp?.certification?.usd}`);
}
if (pricing.products?.tollkeeper?.tolls?.toll_5_exactness?.usd_per_check !== 0.05) {
  failures.push("pricing.json products.tollkeeper.tolls.toll_5_exactness.usd_per_check: expected 0.05");
}
if (pricing.products?.teachaid?.disputed !== true) {
  failures.push("pricing.json products.teachaid must be marked disputed:true");
}
const disputedKeys = Object.keys(pricing.disputed ?? {}).filter((k) => k !== "note").sort();
const wantDisputed = ["pcc_free_window", "teachaid"].sort();
if (JSON.stringify(disputedKeys) !== JSON.stringify(wantDisputed)) {
  failures.push(`pricing.json disputed keys: expected ${wantDisputed.join(",")}, got ${disputedKeys.join(",")}`);
}

// ---------------------------------------------------------------- 2b. diligence arithmetic + naming (2026-11-22)
const m = pricing.math;
// Lab Pass parts: Chamber year + Rider Solo year + PSI Meter seat year + Warrant add-on year.
const partsSum = m.chamber_year + m.rider_solo_year + m.psi_meter_year + m.warrant_addon_year;
if (partsSum !== m.lab_pass_parts_sum) {
  failures.push(`pricing.json Lab Pass parts: ${m.chamber_year}+${m.rider_solo_year}+${m.psi_meter_year}+${m.warrant_addon_year}=${partsSum}, expected lab_pass_parts_sum ${m.lab_pass_parts_sum}`);
}
// Uniform annual rule: every Rider annual is 10x the monthly (two months free).
for (const [mo, yr] of [["rider_solo", "rider_solo_year"], ["rider_team", "rider_team_year"], ["rider_fleet", "rider_fleet_year"]]) {
  if (m[yr] !== 10 * m[mo]) {
    failures.push(`pricing.json annual rule: math.${yr} (${m[yr]}) is not 10x math.${mo} (${m[mo]})`);
  }
}
// Rider Ops standalone SKUs (live catalog rider-ops-month / rider-ops-year).
const ops = pricing.products?.rider_ops;
if (ops?.plans?.month?.usd !== 37 || ops?.plans?.month?.sku !== "rider-ops-month"
    || ops?.plans?.year?.usd !== 369 || ops?.plans?.year?.sku !== "rider-ops-year") {
  failures.push("pricing.json products.rider_ops must carry month $37 / year $369 plans (rider-ops-month / rider-ops-year)");
}
if (typeof ops?.availability !== "string" || !ops.availability.includes("$37/month") || !ops.availability.includes("$369/year")) {
  failures.push("pricing.json products.rider_ops.availability must state the $37/month and $369/year standalone prices");
}
// ARN naming on the three pages touched: old brand must be gone (header
// names like X-Agent-Rider excluded); new name must be present.
for (const page of ["pricing.html", "products.html", "index.html"]) {
  const text = read(page);
  if (/(?<!X-)Agent-Rider/.test(text)) {
    failures.push(`${page}: stale brand "Agent-Rider" (rename to Agent Rider Network)`);
  }
  if (/Agent Rider(?! Network)/.test(text)) {
    failures.push(`${page}: stale brand "Agent Rider" without "Network"`);
  }
  if (!text.includes("Agent Rider Network")) {
    failures.push(`${page}: missing new brand "Agent Rider Network"`);
  }
}

// ---------------------------------------------------------------- 3. pricing-data.mjs hand-sync check
const mjs = await import(pathToFileURL(join(SITE, "assets", "pricing-data.mjs")).href);
if (JSON.stringify(mjs.PRICING) !== JSON.stringify(pricing)) {
  failures.push("assets/pricing-data.mjs does not deep-equal pricing.json — hand-sync it");
}

// ---------------------------------------------------------------- 4. stale-pattern scan over live HTML
const STALE = [
  [/Chamber Year · \$369/, "Chamber Year $369 anchor label"],
  [/\$9\/\$37\/\$369/, "PCC $9/$37/$369 tiers"],
  [/\$9 \/ \$37 \/ \$369/, "PCC $9 / $37 / $369 tiers"],
  [/\$3\.31/, "Rider $3.31"],
  [/\$631/, "Rider $631"],
  [/Lab Pass \$890/, "Lab Pass $890"],
  [/\$890/, "$890"],
  [/PSI Meter \$19/, "PSI Meter $19"],
  [/PCC Pro \$49/, "PCC Pro $49"],
  [/PCC month is \$49/, "PCC month $49"],
  [/8¢/, "8¢/GB meter"],
  [/first 2 GB/i, "first 2 GB free allowance"],
  [/2 GB\/month/, "2 GB/month free allowance"],
  [/2 GB \/ month/, "2 GB / month free allowance"],
  [/2 GB\/mo/, "2 GB/mo free allowance"],
];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(SITE, full);
    if (statSync(full).isDirectory()) {
      // Excluded: dated blog posts (archive) and web-sample fixtures.
      if (rel === "blog" || rel === join("assets", "web-samples")) continue;
      walk(full);
    } else if (name.endsWith(".html")) {
      if (rel.startsWith(`blog${sep}`) || rel.startsWith(`assets${sep}web-samples${sep}`)) continue;
      const text = readFileSync(full, "utf8");
      for (const [re, label] of STALE) {
        if (re.test(text)) failures.push(`${rel}: stale pattern (${label})`);
      }
    }
  }
}
walk(SITE);

// ---------------------------------------------------------------- report
if (failures.length) {
  console.error(`check-prices: FAIL (${failures.length})`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-prices: PASS (${EXPECT.length} canonical assertions, ${Object.keys(MATH_EXPECT).length - 1} math values, stale scan clean)`);
