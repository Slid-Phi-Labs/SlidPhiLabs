/**
 * Slid Phi Labs — Buy panel. One checkout on every product page.
 *
 * Mount:  <div data-spl-buy="rider"></div>   (any key in GROUPS, or "all" for /pay)
 * Prices: GET /api/payments (products[].amount_cents) — the server's catalog wins.
 * Rails:  GET /api/payments (rails[].configured) — only configured rails show.
 * Pay:    POST /api/checkout { sku, email, rail } — stripe | crypto | invoice.
 * Agents: POST /api/x402-products { sku } → 402 → pay exact → retry with X-PAYMENT.
 */
(function () {
  "use strict";

  const GROUPS = {
    rider: {
      name: "Agent-Rider",
      plans: [
        { sku: "rider-solo", cycle: "m", label: "Solo", sub: "Warrant add-on available" },
        { sku: "rider-team", cycle: "m", label: "Team", sub: "Warrant included" },
        { sku: "rider-fleet", cycle: "m", label: "Fleet", sub: "Warrant + Ops watch included" },
        { sku: "rider-solo-year", cycle: "y", label: "Solo", sub: "Warrant add-on available" },
        { sku: "rider-team-year", cycle: "y", label: "Team", sub: "Warrant included" },
        { sku: "rider-fleet-year", cycle: "y", label: "Fleet", sub: "Warrant + Ops watch included" },
      ],
    },
    warrant: {
      name: "Warrant",
      plans: [
        { sku: "warrant-addon", cycle: "m", label: "Warrant add-on", sub: "For Rider Solo. Included in Team and Fleet." },
        { sku: "warrant-addon-year", cycle: "y", label: "Warrant add-on", sub: "For Rider Solo. Included in Team and Fleet." },
      ],
    },
    chamber: {
      name: "Chamber",
      plans: [
        { sku: "chamber-month", cycle: "m", label: "Chamber license", sub: "Seal new JSON. Opening stays free." },
        { sku: "chamber-year", cycle: "y", label: "Chamber license", sub: "Seal new JSON. Opening stays free." },
      ],
    },
    pcc: {
      name: "PCC Pro",
      plans: [
        { sku: "pcc-pro", cycle: "m", label: "PCC Pro", sub: "100 GB included, then $0.20/GB" },
        { sku: "pcc-pro-year", cycle: "y", label: "PCC Pro", sub: "100 GB included each month, then $0.20/GB" },
      ],
      note: "Or pay as you go: first 1 GB free once per address, then $0.25/GB.",
    },
    trustream: {
      name: "TRUSTREAM",
      plans: [
        { sku: "pcc-pro", cycle: "m", label: "PCC Pro", sub: "TRUSTREAM runs on your PCC plan" },
        { sku: "pcc-pro-year", cycle: "y", label: "PCC Pro", sub: "TRUSTREAM runs on your PCC plan" },
      ],
    },
    persist: {
      name: "PSI Meter",
      plans: [
        { sku: "psi-meter", cycle: "m", label: "PSI Meter", sub: "The call log, per seat" },
        { sku: "psi-org", cycle: "m", label: "PSI Org", sub: "Monthly audits plus enforcement" },
        { sku: "psi-meter-year", cycle: "y", label: "PSI Meter", sub: "The call log, per seat" },
      ],
      note: "PERsiST session rates are not set yet, so PERsiST itself does not check out. PSI Meter is its own seat.",
    },
    cuni: {
      name: "CuNi",
      plans: [{ sku: "cuni-exception", label: "Closed-app grant", sub: "One app, one year. Studio stays free." }],
      note: "Hosted CuNi calls are paid per call, by agents over x402.",
    },
    teachaid: {
      name: "TEACHAiD",
      plans: [
        { sku: "teachaid-student", cycle: "m", label: "Student", sub: "Personal teacher, cites the textbook" },
        { sku: "teachaid-student-year", cycle: "y", label: "Student", sub: "Personal teacher, cites the textbook" },
      ],
      note: "Schools and districts: choose Invoice and we'll quote per student.",
    },
    "lab-pass": {
      name: "Lab Pass",
      plans: [{ sku: "lab-pass", label: "Lab Pass", sub: "Chamber + Rider Solo + PSI Meter + Warrant, one year" }],
    },
    pulsar: {
      name: "pulsar",
      plans: [{ sku: "pulsar-exception", label: "Closed-embed grant", sub: "One product, one year. pulsar stays GPLv3." }],
    },
    tnssrc: {
      name: "TNSSRC",
      plans: [
        { sku: "tnssrc-grant", label: "Closed grant", sub: "One year" },
        { sku: "tnssrc-bakeoff", label: "Host bake-off", sub: "Monthly" },
      ],
    },
    consulting: {
      name: "Consulting",
      plans: [{ sku: "consulting", label: "Lab consulting", sub: "2-hour minimum" }],
    },
    acp: {
      name: "ACP certification",
      plans: [{ sku: "acp-certification", label: "ACP Conformant assessment", sub: "One-time" }],
    },
    "rider-ops": {
      name: "Rider Ops",
      plans: [
        { sku: "rider-ops-month", cycle: "m", label: "Rider Ops", sub: "Fleet watch. Included in Fleet." },
        { sku: "rider-ops-year", cycle: "y", label: "Rider Ops", sub: "Fleet watch. Included in Fleet." },
      ],
    },
  };
  const ALL_ORDER = ["rider", "warrant", "chamber", "pcc", "persist", "teachaid", "lab-pass", "cuni", "pulsar", "tnssrc", "rider-ops", "acp", "consulting"];

  // Fallback prices (cents) if /api/payments is unreachable. The server's catalog wins.
  const FALLBACK = {
    "rider-solo": 1200, "rider-team": 4900, "rider-fleet": 19900,
    "rider-solo-year": 12000, "rider-team-year": 49000, "rider-fleet-year": 199000,
    "warrant-addon": 800, "warrant-addon-year": 8000,
    "chamber-month": 2000, "chamber-year": 20000,
    "pcc-pro": 2500, "pcc-pro-year": 25000,
    "psi-meter": 2500, "psi-org": 7900, "psi-meter-year": 25000,
    "cuni-exception": 49000, "teachaid-student": 600, "teachaid-student-year": 6000,
    "lab-pass": 49500, "pulsar-exception": 49000, "tnssrc-grant": 36900, "tnssrc-bakeoff": 1931,
    consulting: 35000, "acp-certification": 99000, "rider-ops-month": 3700, "rider-ops-year": 36900,
  };
  const PER = {
    "rider-solo": "/mo", "rider-team": "/mo", "rider-fleet": "/mo",
    "rider-solo-year": "/yr", "rider-team-year": "/yr", "rider-fleet-year": "/yr",
    "warrant-addon": "/mo", "warrant-addon-year": "/yr", "chamber-month": "/mo", "chamber-year": "/yr",
    "pcc-pro": "/mo", "pcc-pro-year": "/yr", "psi-meter": "/mo", "psi-org": "/mo", "psi-meter-year": "/yr",
    "cuni-exception": "/yr", "teachaid-student": "/mo", "teachaid-student-year": "/yr", "lab-pass": "/yr",
    "pulsar-exception": "/yr", "tnssrc-grant": "/yr", "tnssrc-bakeoff": "/mo", consulting: "", "acp-certification": "",
    "rider-ops-month": "/mo", "rider-ops-year": "/yr",
  };

  let matrixPromise = null;
  function matrix() {
    if (!matrixPromise) {
      matrixPromise = fetch("/api/payments", { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return matrixPromise;
  }

  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach((c) => c && n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }
  const usd = (c) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const usd2 = (c) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function railsFrom(m) {
    const by = {};
    (m && m.rails ? m.rails : []).forEach((r) => { if (r) by[r.id] = r; });
    const known = !!(m && m.rails);
    const rails = [];
    if (!known || by.stripe_checkout?.configured) {
      rails.push({ id: "card", rail: "stripe", name: "Card", sub: "Apple Pay · Google Pay · Link · bank", verb: "Pay {P} with card" });
    }
    const chains = [];
    if (by.crypto_manual_solana?.configured) chains.push("Solana");
    if (by.crypto_manual_evm?.configured) chains.push("Base");
    const btc = !!by.crypto_manual_btc?.configured;
    if (chains.length || btc) {
      const parts = [];
      if (chains.length) parts.push("USDC on " + chains.join(" or "));
      if (btc) parts.push("BTC");
      rails.push({ id: "crypto", rail: "crypto", name: "Crypto", sub: parts.join(" · "), verb: "Get {P} payment address" });
    }
    if (by.paypal?.configured && by.paypal.url) {
      rails.push({ id: "paypal", rail: "paypal", name: "PayPal", sub: "Pay, then send us the receipt", verb: "Pay {P} with PayPal", url: by.paypal.url });
    }
    rails.push({ id: "invoice", rail: "invoice", name: "Invoice", sub: "ACH or wire · companies", verb: "Request a {P} invoice" });
    return rails;
  }

  function priceMap(m) {
    const p = Object.assign({}, FALLBACK);
    (m && m.products ? m.products : []).forEach((row) => {
      if (row && row.sku && typeof row.amount_cents === "number" && row.sell !== false) p[row.sku] = row.amount_cents;
    });
    return p;
  }

  function mount(host) {
    const key = host.getAttribute("data-spl-buy");
    if (host.dataset.splBuyMounted) return;
    host.dataset.splBuyMounted = "1";
    const isAll = key === "all";
    const startKey = isAll ? (new URLSearchParams(location.search).get("product") || "rider") : key;
    const preSku = new URLSearchParams(location.search).get("sku");
    if (!isAll && !GROUPS[key]) return;

    const state = { group: GROUPS[startKey] ? startKey : "rider", cycle: "m", sku: null, rail: null, prices: Object.assign({}, FALLBACK), rails: railsFrom(null), busy: false };
    if (preSku) {
      for (const g of ALL_ORDER) {
        const hit = GROUPS[g].plans.find((p) => p.sku === preSku);
        if (hit) { state.group = isAll ? g : state.group; state.cycle = hit.cycle || "m"; state.sku = preSku; break; }
      }
    }

    const panel = el("aside", { class: "spl-buy", "aria-label": "Checkout" });
    host.appendChild(panel);

    function plansNow() {
      const g = GROUPS[state.group];
      const hasCycle = g.plans.some((p) => p.cycle);
      return { g, hasCycle, list: g.plans.filter((p) => !hasCycle || !p.cycle || p.cycle === state.cycle) };
    }

    function render() {
      const { g, hasCycle, list } = plansNow();
      if (!list.find((p) => p.sku === state.sku)) state.sku = list[0].sku;
      if (!state.rails.find((r) => r.id === state.rail)) state.rail = state.rails[0].id;
      const plan = list.find((p) => p.sku === state.sku);
      const rail = state.rails.find((r) => r.id === state.rail);
      const cents = state.prices[plan.sku] ?? FALLBACK[plan.sku];
      const per = PER[plan.sku] || "";
      const keepOut = panel.querySelector(".spl-buy-out");
      panel.replaceChildren();

      const head = el("div", { class: "spl-buy-head" }, [
        el("h2", { text: (isAll ? "Checkout" : "Buy " + g.name) }),
        hasCycle
          ? el("div", { class: "spl-buy-cycle", role: "group", "aria-label": "Billing" }, [
              el("button", { type: "button", "aria-pressed": String(state.cycle === "m"), text: "Monthly", onclick: () => { state.cycle = "m"; render(); } }),
              el("button", { type: "button", "aria-pressed": String(state.cycle === "y"), text: "Yearly", onclick: () => { state.cycle = "y"; render(); } }),
            ])
          : el("span", { class: "spl-buy-tag", text: per === "/yr" ? "YEARLY" : per === "/mo" ? "MONTHLY" : "ONE-TIME" }),
      ]);
      panel.appendChild(head);

      if (isAll) {
        const sel = el("select", { "aria-label": "Product", class: "spl-buy-select", onchange: (e) => { state.group = e.target.value; state.sku = null; render(); } },
          ALL_ORDER.map((k) => el("option", { value: k, text: GROUPS[k].name, selected: k === state.group })));
        panel.appendChild(el("label", { class: "spl-buy-field" }, ["Product", sel]));
      }

      panel.appendChild(el("div", { class: "spl-buy-plans", role: "group", "aria-label": "Plan" },
        list.map((p) => {
          const c = state.prices[p.sku] ?? FALLBACK[p.sku];
          return el("button", { type: "button", class: "spl-buy-plan", "aria-pressed": String(p.sku === state.sku), onclick: () => { state.sku = p.sku; render(); } }, [
            el("span", { class: "spl-buy-dot", "aria-hidden": "true" }),
            el("span", { class: "spl-buy-plan-text" }, [el("b", { text: p.label }), el("small", { text: p.sub })]),
            el("span", { class: "spl-buy-amt", text: usd(c) + (PER[p.sku] || "") }),
          ]);
        })));
      if (g.note) panel.appendChild(el("p", { class: "spl-buy-note", text: g.note }));

      panel.appendChild(el("p", { class: "spl-buy-label", text: "PAY WITH" }));
      panel.appendChild(el("div", { class: "spl-buy-rails", role: "group", "aria-label": "Payment method" },
        state.rails.map((r) => el("button", { type: "button", class: "spl-buy-rail", "aria-pressed": String(r.id === state.rail), onclick: () => { state.rail = r.id; render(); } }, [
          el("b", { text: r.name }), el("small", { text: r.sub }),
        ]))));

      const email = el("input", { type: "email", name: "email", autocomplete: "email", placeholder: "you@company.com", value: state.email || "", oninput: (e) => { state.email = e.target.value; } });
      panel.appendChild(el("label", { class: "spl-buy-field" }, [rail.id === "card" ? "Email for receipt and access (optional)" : "Email for receipt and access", email]));

      panel.appendChild(el("div", { class: "spl-buy-receipt" }, [
        el("div", {}, [el("span", { text: (plan.label.includes(g.name) || g.name.includes(plan.label) || state.group === "trustream" ? plan.label : g.name + " " + plan.label) + (per ? " · " + (per === "/mo" ? "1 mo" : "1 yr") : "") }), el("span", { text: usd2(cents) })]),
        el("div", { class: "mut" }, [el("span", { text: "Paid by" }), el("span", { text: rail.name })]),
        el("div", { class: "tot" }, [el("span", { text: "TOTAL TODAY" }), el("span", { text: usd2(cents) })]),
      ]));

      const go = el("button", { type: "button", class: "spl-buy-go", disabled: state.busy, text: state.busy ? "Working…" : rail.verb.replace("{P}", usd(cents)) + " →", onclick: () => pay(plan, rail, cents) });
      panel.appendChild(go);
      const out = keepOut || el("div", { class: "spl-buy-out", role: "status", "aria-live": "polite" });
      panel.appendChild(out);

      panel.appendChild(el("p", { class: "spl-buy-agent" }, [
        el("span", { text: "Agents: " }),
        el("code", { text: 'POST /api/x402-products {"sku":"' + plan.sku + '"} → 402 → pay exact → retry with X-PAYMENT' }),
      ]));
      panel.appendChild(el("p", { class: "spl-buy-fine" }, ["Secure checkout · Slid Phi Labs, Inc. · ", el("a", { href: "/refund-policy", text: "Refund policy" })]));
    }

    function say(nodes, tone) {
      const out = panel.querySelector(".spl-buy-out");
      out.replaceChildren(...nodes);
      out.className = "spl-buy-out" + (tone ? " " + tone : "");
    }

    function copyBtn(text) {
      return el("button", { type: "button", class: "spl-buy-copy", text: "Copy", onclick: (e) => {
        const b = e.currentTarget;
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500); }, () => { b.textContent = "Select and copy"; });
      } });
    }

    function mailto(addr, subject, body) {
      return "mailto:" + addr + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    }

    async function post(body) {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw Object.assign(new Error(j.error || "checkout_failed"), { body: j });
      return j;
    }

    async function pay(plan, rail, cents) {
      const em = (state.email || "").trim();
      if (rail.id !== "card" && !/^\S+@\S+\.\S+$/.test(em)) {
        say([el("p", { text: "Add your email so we can send the receipt and your access link." })], "warn");
        panel.querySelector('input[type="email"]').focus();
        return;
      }
      state.busy = true; render();
      try {
        if (rail.id === "card") {
          const j = await post({ sku: plan.sku, email: em || undefined, rail: "stripe" });
          let loops = false;
          try { const u = new URL(j.url, location.href); loops = u.origin === location.origin && /^\/pay\/?$/.test(u.pathname); } catch { loops = false; }
          if (j.url && !loops) { say([el("p", { text: "Opening secure Stripe checkout…" })], "ok"); location.href = j.url; return; }
          throw new Error("no_url");
        }
        if (rail.id === "crypto") {
          const j = await post({ sku: plan.sku, email: em, rail: "crypto" });
          const rows = (j.instructions || []).map((i) => {
            const label = i.rail === "solana" ? "USDC on Solana" : i.rail === "base_evm" ? "USDC on Base" : i.rail === "bitcoin" ? "Bitcoin (USD equivalent)" : i.rail;
            return el("div", { class: "spl-buy-addr" }, [
              el("p", { class: "spl-buy-label", text: label + " · send exactly " + usd2(Math.round(Number(i.amount_usd) * 100)) }),
              el("div", { class: "spl-buy-addr-row" }, [el("code", { text: i.payTo }), copyBtn(i.payTo)]),
              i.memo ? el("small", { text: "Memo: " + i.memo }) : null,
            ]);
          });
          if (!rows.length) throw new Error("no_crypto_rail");
          const c = j.claim || {};
          const body = (c.body || "") .replace("Email used:", "Email used: " + em);
          say([
            el("p", { text: "Send the exact amount to one address below. Then email us the transaction hash; your access link follows." }),
            ...rows,
            c.email ? el("a", { class: "spl-btn spl-btn-dark", href: mailto(c.email, c.subject || "Payment claim", body), text: "Email the transaction hash →" }) : null,
          ], "ok");
          return;
        }
        if (rail.id === "paypal") {
          window.open(rail.url, "_blank", "noopener");
          const m = await matrix();
          const contact = (m && m.contact && (m.contact.email || m.contact)) || "corey@slidphilabs.com";
          say([
            el("p", { text: "PayPal opened in a new tab. Pay " + usd2(cents) + ", then send us the receipt so we can turn on access." }),
            el("a", { class: "spl-btn spl-btn-dark", href: mailto(String(contact), "PayPal payment · " + plan.sku + " · " + usd2(cents), "SKU: " + plan.sku + "\nAmount: " + usd2(cents) + "\nPayPal receipt ID:\nEmail used: " + em + "\n"), text: "Email the PayPal receipt →" }),
          ], "ok");
          return;
        }
        if (rail.id === "invoice") {
          const j = await post({ sku: plan.sku, email: em, rail: "invoice" });
          const body = String(j.body_template || "").replace("Billing email: ", "Billing email: " + em);
          say([
            el("p", { text: "Your email app will open with the invoice request filled in. Add your company name and address, then send. We reply with ACH, wire or a Stripe invoice." }),
            el("a", { class: "spl-btn spl-btn-dark", href: mailto(j.email, j.subject, body), text: "Open the invoice request →" }),
            el("small", { text: "Or email " + j.email + " directly." }),
          ], "ok");
          location.href = mailto(j.email, j.subject, body);
          return;
        }
      } catch (e) {
        say([
          el("p", { text: "That didn't go through. Nothing was charged." }),
          el("p", { text: "Try another payment method above, or email corey@slidphilabs.com and we'll sort it out." }),
        ], "bad");
      } finally {
        state.busy = false;
        render(); // keeps the .spl-buy-out message node
      }
    }

    render();
    matrix().then((m) => {
      if (!m) return;
      state.prices = priceMap(m);
      state.rails = railsFrom(m);
      render();
    });
  }

  // Put the panel beside the page's opening block (kicker, title, lede, actions) on wide screens.
  function split(host) {
    if (host.hasAttribute("data-spl-buy-inline")) return;
    // If the mount opens a nested section, lift it up to the page's top level first.
    const main = host.closest("main") || document.body;
    while (host.parentElement && host.parentElement !== main && !host.previousElementSibling) {
      host.parentElement.parentElement.insertBefore(host, host.parentElement);
    }
    const parent = host.parentElement;
    if (!parent) return;
    const before = [];
    for (let n = parent.firstElementChild; n && n !== host; n = n.nextElementSibling) before.push(n);
    if (!before.length) return;
    const wrap = el("div", { class: "spl-buy-split" });
    const left = el("div", { class: "spl-buy-hero" });
    parent.insertBefore(wrap, before[0]);
    before.forEach((n) => left.appendChild(n));
    wrap.appendChild(left);
    wrap.appendChild(host);
  }

  function boot() {
    document.querySelectorAll("[data-spl-buy]").forEach((h) => { split(h); mount(h); });
  }
  window.SPLBuy = { GROUPS, boot };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
