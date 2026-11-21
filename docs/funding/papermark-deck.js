const pptxgen = require("pptxgenjs");

async function main() {
  const pres = new pptxgen();
  pres.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pres.layout = "WIDE";
  pres.author = "Slid Phi Labs";
  pres.title = "Slid Phi Labs";
  pres.subject = "Papermark pitch — the lab";

  const C = {
    bg: "07111A",
    card: "10232C",
    ink: "E8F2EE",
    mute: "9BB0A8",
    mint: "3DDC97",
    gold: "F5B942",
    red: "FF5A4E",
    line: "1E3A40",
  };
  const sh = () => ({ type: "outer", blur: 14, offset: 4, angle: 135, color: "000000", opacity: 0.28 });
  const TOTAL = 10;

  function foot(slide, n) {
    slide.addText("SLID PHI LABS", {
      x: 0.5, y: 7.12, w: 4, h: 0.22,
      fontFace: "Calibri", fontSize: 11, color: "5E756E", margin: 0,
    });
    slide.addText(n + "  /  " + TOTAL, {
      x: 10.8, y: 7.12, w: 2, h: 0.22,
      fontFace: "Calibri", fontSize: 11, color: "5E756E", align: "right", margin: 0,
    });
  }

  function kicker(slide, text) {
    slide.addText(text, {
      x: 0.5, y: 0.28, w: 12.3, h: 0.26,
      fontFace: "Calibri", fontSize: 12, bold: true, color: C.mint, charSpacing: 1.8, margin: 0,
    });
  }

  // 1 Title
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: C.mint } });
    s.addText("SLID PHI LABS", {
      x: 0.7, y: 1.35, w: 11, h: 0.32,
      fontFace: "Calibri", fontSize: 14, bold: true, color: C.mint, charSpacing: 2.2, margin: 0,
    });
    s.addText("Agents that spend\nneed a name, a limit,\nand a receipt.", {
      x: 0.7, y: 1.8, w: 12, h: 2.7,
      fontFace: "Trebuchet MS", fontSize: 44, bold: true, color: C.ink, margin: 0,
    });
    s.addText("The lab. Measured model-bill savings. Signed agents. Exact calls.", {
      x: 0.7, y: 4.7, w: 10, h: 0.4,
      fontFace: "Calibri", fontSize: 18, color: C.mute, margin: 0,
    });
    s.addText("Corey Tasz    Cherry Hill, New Jersey    slidphilabs.com    corey@slidphilabs.com", {
      x: 0.7, y: 6.55, w: 12, h: 0.3,
      fontFace: "Calibri", fontSize: 14, color: "7E948C", margin: 0,
    });
  }

  // 2 The number
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "PSI    MEASURED OCTOBER 2026");
    s.addText("Same 304 million token session.", {
      x: 0.5, y: 0.62, w: 12, h: 0.48,
      fontFace: "Trebuchet MS", fontSize: 28, bold: true, color: C.ink, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.35, w: 6.0, h: 3.55, fill: { color: C.card }, shadow: sh() });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.35, w: 0.1, h: 3.55, fill: { color: C.red } });
    s.addText("UNPROFILED", {
      x: 0.85, y: 1.55, w: 5.3, h: 0.28,
      fontFace: "Calibri", fontSize: 13, bold: true, color: C.red, margin: 0,
    });
    s.addText("about $631", {
      x: 0.85, y: 2.05, w: 5.3, h: 1.15,
      fontFace: "Trebuchet MS", fontSize: 54, bold: true, color: C.ink, margin: 0,
    });
    s.addText("Priced as if the cache were not doing the work.", {
      x: 0.85, y: 3.4, w: 5.2, h: 1.0,
      fontFace: "Calibri", fontSize: 18, color: C.mute, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 1.35, w: 6.0, h: 3.55, fill: { color: C.card }, shadow: sh() });
    s.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 1.35, w: 0.1, h: 3.55, fill: { color: C.mint } });
    s.addText("CACHE HELD", {
      x: 7.15, y: 1.55, w: 5.3, h: 0.28,
      fontFace: "Calibri", fontSize: 13, bold: true, color: C.mint, margin: 0,
    });
    s.addText("about $116", {
      x: 7.15, y: 2.05, w: 5.3, h: 1.15,
      fontFace: "Trebuchet MS", fontSize: 54, bold: true, color: C.mint, margin: 0,
    });
    s.addText("About a fifth. October 2026 rates on the major model APIs.", {
      x: 7.15, y: 3.4, w: 5.2, h: 1.0,
      fontFace: "Calibri", fontSize: 18, color: C.mute, margin: 0,
    });
    s.addText("Five of our sessions.  787.7M input.  6.35M output.  124:1.  Longest session: 288.8M of 304.3M input tokens cache-served, 94%.", {
      x: 0.5, y: 5.15, w: 12.3, h: 0.7,
      fontFace: "Calibri", fontSize: 16, color: C.ink, margin: 0,
    });
    s.addText("The fifth holds only while prefixes stay stable, polls stay rare, reads stay bounded, and re-runs stay earned. PSI watches those four.", {
      x: 0.5, y: 5.9, w: 12.3, h: 0.7,
      fontFace: "Calibri", fontSize: 16, color: C.mute, margin: 0,
    });
    foot(s, 2);
  }

  // 3 PSI product
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "PSI METER");
    s.addText("Every model call gets a tag. The three biggest leaks come first.", {
      x: 0.5, y: 0.62, w: 12.3, h: 0.5,
      fontFace: "Trebuchet MS", fontSize: 26, bold: true, color: C.ink, margin: 0,
    });
    ["Hours", "Memories", "Dollars", "Tokens", "Carbon", "Time"].forEach((t, i) => {
      const x = 0.5 + i * 2.12;
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.35, w: 2.0, h: 0.62, fill: { color: C.card } });
      s.addText(t, {
        x, y: 1.35, w: 2.0, h: 0.62,
        fontFace: "Trebuchet MS", fontSize: 16, bold: true, color: C.ink, align: "center", valign: "middle", margin: 0,
      });
    });
    const plans = [
      ["$25", "a seat a month", "250,000 logged calls included, then $2 per 100,000. Free: 1 seat, 10,000 calls a month, 7-day retention."],
      ["$250", "a seat a year", "Same allowance, paid once. SKU psi-meter-year."],
      ["$79", "PSI Org a month", "A crew on one bill. Quarterly audits, enforced caps, cache discipline."],
    ];
    plans.forEach((p, i) => {
      const y = 2.25 + i * 1.45;
      s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y, w: 12.3, h: 1.3, fill: { color: C.card }, shadow: sh() });
      s.addText(p[0], {
        x: 0.75, y: y + 0.22, w: 1.8, h: 0.86,
        fontFace: "Trebuchet MS", fontSize: 32, bold: true, color: C.gold, margin: 0, valign: "middle",
      });
      s.addText(p[1], {
        x: 2.7, y: y + 0.22, w: 3.1, h: 0.86,
        fontFace: "Calibri", fontSize: 18, color: C.ink, margin: 0, valign: "middle",
      });
      s.addText(p[2], {
        x: 6.0, y: y + 0.18, w: 6.5, h: 0.94,
        fontFace: "Calibri", fontSize: 16, color: C.mute, margin: 0, valign: "middle",
      });
    });
    foot(s, 3);
  }

  // 4 Rails
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "THE LAB");
    s.addText("One company. The rails an agent needs before money moves.", {
      x: 0.5, y: 0.6, w: 12.3, h: 0.48,
      fontFace: "Trebuchet MS", fontSize: 26, bold: true, color: C.ink, margin: 0,
    });
    const items = [
      ["Rider", "Who", "Signed identity. A stranger checks the published keys. Solo $12, Team $49, Fleet $199 a month."],
      ["Warrant", "What", "Spend cap and receipt, bound to a Rider. $8 a month on Solo. Included in Team and Fleet."],
      ["CuNi", "Check", "Same stdout or refuse. 53 targets. Nine calls from $0.05 to $1.00. Studio is free."],
      ["PSI", "The bill", "The meter behind the $631 to $116 result. Tags every model call."],
      ["ACN", "The network", "Agent Commerce Network 1.0.0. JSON-RPC on /mcp. Each staged run files a receipt. Paid tools answer 402."],
      ["ACP", "Settlement", "Open standard, $0. Offer, invoice, receipt. Conformant certification $990 once. Three pilots free."],
      ["AwLPay", "The lock", "Quotes a fee and locks it. A mismatch is a refusal. The quote is live. Moving money still needs a signed wallet."],
      ["Chamber", "The seal", "Two keys seal JSON. $20 a month or $200 a year. Opening a sealed file stays free."],
    ];
    items.forEach((it, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 0.45 + col * 3.2;
      const y = 1.3 + row * 2.75;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 3.05, h: 2.55, fill: { color: C.card }, shadow: sh() });
      s.addText(it[1].toUpperCase(), {
        x: x + 0.16, y: y + 0.14, w: 2.7, h: 0.24,
        fontFace: "Calibri", fontSize: 11, bold: true, color: C.gold, margin: 0,
      });
      s.addText(it[0], {
        x: x + 0.16, y: y + 0.4, w: 2.7, h: 0.42,
        fontFace: "Trebuchet MS", fontSize: 20, bold: true, color: C.ink, margin: 0,
      });
      s.addText(it[2], {
        x: x + 0.16, y: y + 0.95, w: 2.73, h: 1.4,
        fontFace: "Calibri", fontSize: 13, color: C.mute, margin: 0,
      });
    });
    foot(s, 4);
  }

  // 5 How a call is allowed
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "AGENT WORK");
    s.addText("A person approves once. The warrant enforces it.", {
      x: 0.5, y: 0.62, w: 12, h: 0.5,
      fontFace: "Trebuchet MS", fontSize: 28, bold: true, color: C.ink, margin: 0,
    });
    const steps = [
      ["01", "Sign the mandate", "Amount, scope, and expiry. A Warrant. Not a blank approval."],
      ["02", "Present the Rider", "Signed, portable, revocable. The other side checks the keys."],
      ["03", "The gate decides", "Over the limit, denied before money moves. A receipt files what ran."],
    ];
    steps.forEach((st, i) => {
      const x = 0.5 + i * 4.2;
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.45, w: 4.0, h: 3.35, fill: { color: C.card }, shadow: sh() });
      s.addText(st[0], {
        x: x + 0.25, y: 1.65, w: 3.5, h: 0.7,
        fontFace: "Trebuchet MS", fontSize: 32, bold: true, color: C.gold, margin: 0,
      });
      s.addText(st[1], {
        x: x + 0.25, y: 2.45, w: 3.5, h: 0.7,
        fontFace: "Trebuchet MS", fontSize: 22, bold: true, color: C.ink, margin: 0,
      });
      s.addText(st[2], {
        x: x + 0.25, y: 3.25, w: 3.5, h: 1.2,
        fontFace: "Calibri", fontSize: 16, color: C.mute, margin: 0,
      });
    });
    s.addText("CuNi sits behind the receipt. One name on the CLI, on POST /v1, on MCP, and in the Python client.", {
      x: 0.5, y: 5.1, w: 12.3, h: 0.45,
      fontFace: "Calibri", fontSize: 16, color: C.ink, margin: 0,
    });
    s.addText("ACN carries the message. ACP is the open settlement standard. AwLPay refuses a payment that does not match the locked quote.", {
      x: 0.5, y: 5.6, w: 12.3, h: 0.7,
      fontFace: "Calibri", fontSize: 16, color: C.mute, margin: 0,
    });
    foot(s, 5);
  }

  // 6 CuNi
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "CUNI");
    s.addText("Same output, or the call refuses.", {
      x: 0.5, y: 0.58, w: 12, h: 0.46,
      fontFace: "Trebuchet MS", fontSize: 28, bold: true, color: C.ink, margin: 0,
    });
    s.addText("53 targets. Python, Go, and JavaScript must print the same stdout. Studio is free. A closed app is $490 a year.", {
      x: 0.5, y: 1.12, w: 12.3, h: 0.4,
      fontFace: "Calibri", fontSize: 16, color: C.mute, margin: 0,
    });
    const calls = [
      ["check", "$0.05", "First 100 a month free"],
      ["translate", "$0.10", "One bank paste"],
      ["ingest", "$0.10", "Foreign source, or refuse"],
      ["money", "$0.25", "Decimal proof"],
      ["time", "$0.25", "Clock and calendar"],
      ["parity", "$0.25", "Same bytes across seats"],
      ["chain", "$0.50", "One chain emit"],
      ["ship", "$0.50", "C and Rust, or nothing ships"],
      ["audit", "$1.00", "A law against a foreign build"],
    ];
    calls.forEach((c, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.5 + col * 4.2;
      const y = 1.7 + row * 1.65;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.0, h: 1.48, fill: { color: C.card }, shadow: sh() });
      s.addText(c[0], {
        x: x + 0.22, y: y + 0.18, w: 2.2, h: 0.42,
        fontFace: "Trebuchet MS", fontSize: 20, bold: true, color: C.ink, margin: 0,
      });
      s.addText(c[1], {
        x: x + 2.2, y: y + 0.18, w: 1.55, h: 0.42,
        fontFace: "Trebuchet MS", fontSize: 20, bold: true, color: C.gold, align: "right", margin: 0,
      });
      s.addText(c[2], {
        x: x + 0.22, y: y + 0.72, w: 3.55, h: 0.5,
        fontFace: "Calibri", fontSize: 15, color: C.mute, margin: 0,
      });
    });
    foot(s, 6);
  }

  // 7 Public compression
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "COMPRESSION    PUBLIC");
    s.addText("A keep is a smaller file that restores every byte.", {
      x: 0.5, y: 0.58, w: 12.3, h: 0.45,
      fontFace: "Trebuchet MS", fontSize: 26, bold: true, color: C.ink, margin: 0,
    });
    s.addText("Official Silesia 12. Raw 211,938,580 bytes. Not a first-place claim.", {
      x: 0.5, y: 1.08, w: 12.3, h: 0.32,
      fontFace: "Calibri", fontSize: 14, color: C.mute, margin: 0,
    });
    const head = [
      { t: "METHOD", x: 0.5, w: 2.3 },
      { t: "STRONG SUIT", x: 2.9, w: 3.4 },
      { t: "PUBLISHED", x: 6.4, w: 6.4 },
    ];
    head.forEach((h) => {
      s.addText(h.t, {
        x: h.x, y: 1.5, w: h.w, h: 0.3,
        fontFace: "Calibri", fontSize: 12, bold: true, color: C.gold, margin: 0,
      });
    });
    const rows = [
      ["PCC", "Everyday files", "51,498,645. 12/12 restored."],
      ["pulsar", "GPLv3 binary you run", "55,745,438. Beats gzip-9. Loses to xz."],
      ["TNSSRC", "Local rows, AGPL", "43,724,575. 12/12 decode and SHA-256."],
      ["TRUSTREAM", "Live logs", "4 KiB tiles. Quiet tiles shrink. The stream returns."],
      ["TRU8", "Zeros", "A million zeros round-trip to 8 bytes."],
      ["champ", "Scoreboard lane", "50,541,135. 12/12 restored."],
    ];
    rows.forEach((r, i) => {
      const y = 1.9 + i * 0.8;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y, w: 12.3, h: 0.72,
        fill: { color: i % 2 === 0 ? C.card : "0C1C24" },
      });
      s.addText(r[0], { x: 0.65, y, w: 2.1, h: 0.72, fontFace: "Trebuchet MS", fontSize: 16, bold: true, color: C.mint, margin: 0, valign: "middle" });
      s.addText(r[1], { x: 2.9, y, w: 3.3, h: 0.72, fontFace: "Calibri", fontSize: 15, color: C.ink, margin: 0, valign: "middle" });
      s.addText(r[2], { x: 6.4, y, w: 6.2, h: 0.72, fontFace: "Calibri", fontSize: 15, color: C.mute, margin: 0, valign: "middle" });
    });
    foot(s, 7);
  }

  // 8 Private compression
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "COMPRESSION    PRIVATE");
    s.addText("Named here. A strong suit waits for a public board.", {
      x: 0.5, y: 0.58, w: 12.3, h: 0.48,
      fontFace: "Trebuchet MS", fontSize: 26, bold: true, color: C.ink, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.25, w: 12.3, h: 1.15, fill: { color: C.card }, shadow: sh() });
    s.addText("COMBINED GC", {
      x: 0.75, y: 1.4, w: 4, h: 0.35,
      fontFace: "Trebuchet MS", fontSize: 16, bold: true, color: C.gold, margin: 0,
    });
    s.addText("The private engine tree. Not a product name. Not a price. The method stays in the lab.", {
      x: 0.75, y: 1.8, w: 11.6, h: 0.4,
      fontFace: "Calibri", fontSize: 16, color: C.mute, margin: 0,
    });
    const names = [
      ["zrw", "Integer data"],
      ["solid-rle", "Not published"],
      ["own-lz", "Not published"],
      ["bwt-ans", "Not published"],
      ["strand", "Not published"],
      ["zeck", "Not published"],
      ["cm2", "Not published"],
      ["cm3", "Not published"],
      ["cmc", "Not published"],
      ["cm4", "Not published"],
      ["cmx", "Not published"],
      ["cmf", "Not published"],
      ["rs3", "Not published"],
    ];
    names.forEach((n, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 0.5 + col * 2.52;
      const y = 2.65 + row * 1.35;
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 2.4, h: 1.2, fill: { color: C.card } });
      s.addText(n[0], {
        x: x + 0.12, y: y + 0.16, w: 2.16, h: 0.4,
        fontFace: "Trebuchet MS", fontSize: 16, bold: true, color: C.ink, margin: 0,
      });
      s.addText(n[1], {
        x: x + 0.12, y: y + 0.6, w: 2.16, h: 0.4,
        fontFace: "Calibri", fontSize: 13, color: C.mute, margin: 0,
      });
    });
    foot(s, 8);
  }

  // 9 Prices
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    kicker(s, "POSTED PRICES");
    s.addText("Calls and seats. The figure is the price.", {
      x: 0.5, y: 0.58, w: 12, h: 0.46,
      fontFace: "Trebuchet MS", fontSize: 28, bold: true, color: C.ink, margin: 0,
    });
    const rows = [
      ["Rider", "Solo $12    Team $49    Fleet $199 a month"],
      ["Warrant", "$8 a month on Solo, $80 a year. Included in Team and Fleet."],
      ["CuNi", "$0.05 to $1.00 a call. Studio $0. Closed app $490 a year."],
      ["PSI", "$25 a seat a month. $250 a year. Org $79 a month."],
      ["Chamber", "$20 a month. $200 a year."],
      ["Quikgater", "$0.02 a fetch after the first 100 in a month. Cap defaults to $10."],
      ["ACP", "$0 open standard. Conformant certification $990 once."],
      ["Lab Pass", "$495 a year. Chamber, Rider Solo, one PSI seat, Warrant. Parts sum $650."],
    ];
    rows.forEach((r, i) => {
      const y = 1.22 + i * 0.68;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y, w: 12.3, h: 0.62,
        fill: { color: i % 2 === 0 ? C.card : "0C1C24" },
      });
      s.addText(r[0], {
        x: 0.7, y, w: 2.4, h: 0.62,
        fontFace: "Trebuchet MS", fontSize: 16, bold: true, color: C.mint, margin: 0, valign: "middle",
      });
      s.addText(r[1], {
        x: 3.2, y, w: 9.3, h: 0.62,
        fontFace: "Calibri", fontSize: 16, color: C.ink, margin: 0, valign: "middle",
      });
    });
    foot(s, 9);
  }

  // 10 Ask
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: C.gold } });
    kicker(s, "THE ASK");
    s.addText("$500,000\npre-seed.", {
      x: 0.7, y: 0.7, w: 12, h: 1.7,
      fontFace: "Trebuchet MS", fontSize: 48, bold: true, color: C.ink, margin: 0,
    });
    s.addText("Product engineering, compute, go-to-market, and operations. Turn the live seats and the PSI meter into paying use.", {
      x: 0.7, y: 2.55, w: 11.5, h: 0.7,
      fontFace: "Calibri", fontSize: 18, color: C.mute, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 3.45, w: 11.8, h: 1.7, fill: { color: C.card }, shadow: sh() });
    s.addText("PAPERMARK", {
      x: 0.95, y: 3.6, w: 11, h: 0.28,
      fontFace: "Calibri", fontSize: 12, bold: true, color: C.gold, margin: 0,
    });
    s.addText("€15,000, equity free, would fund the first Slid Phi Node and its pilot. This deck is the lab, not one product.", {
      x: 0.95, y: 4.0, w: 11.2, h: 0.85,
      fontFace: "Calibri", fontSize: 18, color: C.ink, margin: 0,
    });
    s.addText("Slid Phi Labs LLC    New Jersey    formed 16 Oct 2026    entity 0451545324\nCorey Tasz    corey@slidphilabs.com    slidphilabs.com    TeachAid is live", {
      x: 0.7, y: 5.45, w: 11.5, h: 0.7,
      fontFace: "Calibri", fontSize: 15, color: C.mute, margin: 0,
    });
    foot(s, 10);
  }

  await pres.writeFile({ fileName: "C:/Users/ptasz/SlidPhiLabs/docs/funding/slid-phi-labs-pitch-deck.pptx" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
