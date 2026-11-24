/** One header, footer, one logo — every page. */
(function () {
  const NAV = [
    ["/products", "Products"],
    ["/pricing", "Pricing"],
    ["/docs", "Docs"],
    ["/wiki", "Wiki"],
    ["/agents", "Agents"],
  ];
  const MORE = [
    ["/rider", "Agent-Rider"],
    ["/warrant", "Warrant"],
    ["/persist", "PERsiST"],
    ["/chamber", "Chamber"],
    ["/cuni", "CuNi"],
    ["/pcc", "PCC"],
    ["/trustream", "TRUSTREAM"],
    ["/awlpay", "AwLPay"],
    ["/teachaid", "TEACHAiD"],
    ["/quikgater", "Quikgater"],
    ["/tollkeeper", "Tollkeeper"],
    ["/lab-pass", "Lab Pass"],
    ["/silesia", "Silesia"],
    ["/mcp-service", "MCP"],
    ["/about", "About"],
    ["/press", "Press"],
  ];
  const LOGO = "/assets/brand/sp-logo-120.png";
  const LOGO_2X = "/assets/brand/sp-logo-240.png";


  function path() {
    let p = location.pathname;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p || "/";
  }

  function header() {
    const here = path();
    const links = NAV.map(([href, label]) => {
      const cur = href === here || (href !== "/" && here.startsWith(href));
      return `<a href="${href}"${cur ? ' aria-current="page"' : ""}>${label}</a>`;
    }).join("");
    const more = MORE.map(([href, label]) => {
      const cur = href === here || (href !== "/" && here.startsWith(href));
      return `<a href="${href}"${cur ? ' aria-current="page"' : ""}>${label}</a>`;
    }).join("");
    return `<a class="spl-skip" href="#main">Skip to content</a>
    <div class="spl-top">
    <header class="spl-header" role="banner">
      <div class="bar">
        <a class="spl-brand" href="/" aria-label="Slid Phi Labs home">
          <img src="${LOGO}" srcset="${LOGO} 1x, ${LOGO_2X} 2x" width="62" height="54" alt="Slid Phi Labs"/>
          <span>Slid Phi Labs</span>
        </a>
        <button class="spl-nav-toggle" type="button" aria-expanded="false" aria-controls="spl-nav" aria-label="Menu"></button>
        <nav class="spl-nav" id="spl-nav" aria-label="Primary">${links}<details class="spl-drop"><summary>Products A–Z</summary><div class="spl-drop-menu">${more}</div></details><span data-spl-auth></span><a class="spl-buy-cta" href="/pay">Buy →</a></nav>
      </div>
    </header>`;
  }

  function footer() {
    return `<footer class="spl-footer" role="contentinfo">
    <div class="inner">
      <div class="spl-foot-brand">
        <img src="${LOGO}" srcset="${LOGO} 1x, ${LOGO_2X} 2x" width="74" height="64" alt="Slid Phi Labs"/>
        <p>Tools that check. Proof before praise.</p>
      </div>
      <div>
        <h4>Agents</h4>
        <a href="/rider">Agent-Rider</a>
        <a href="/warrant">Warrant</a>
        <a href="/persist">PERsiST</a>
        <a href="/chamber">Chamber</a>
        <a href="/awlpay">AwLPay</a>
      </div>
      <div>
        <h4>Exact</h4>
        <a href="/cuni">CuNi</a>
        <a href="/pcc">PCC</a>
        <a href="/trustream">TRUSTREAM</a>
        <a href="/pulsar">pulsar</a>
        <a href="/bench">Bench</a>
      </div>
      <div>
        <h4>Buy</h4>
        <a href="/pay">Checkout</a>
        <a href="/pricing">Pricing</a>
        <a href="/lab-pass">Lab Pass</a>
        <a href="/box">Try 24 hours</a>
        <a href="/teachaid">TEACHAiD</a>
      </div>
      <div>
        <h4>For agents</h4>
        <a href="/agents">Start here</a>
        <a href="/api/agent">/api/agent</a>
        <a href="/llms.txt">llms.txt</a>
        <a href="/mcp">/mcp</a>
        <a href="/x402">x402</a>
      </div>
      <div>
        <h4>Company</h4>
        <a href="/about">About</a>
        <a href="/press">Press</a>
        <a href="/contact">Contact</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/refund-policy">Refunds</a>
      </div>
    </div>
    <p class="legal">© ${new Date().getFullYear()} Slid Phi Labs, Inc. · Cherry Hill, New Jersey · <a href="mailto:corey@slidphilabs.com" style="display:inline;min-height:0;font-size:inherit">corey@slidphilabs.com</a></p>
  </footer>`;
  }

  function inject() {
    if (document.body.classList.contains("spl-chrome")) return;
    const top = header();
    document.body.insertAdjacentHTML("afterbegin", top);
    if (!document.querySelector("footer.spl-footer")) {
      document.body.insertAdjacentHTML("beforeend", footer());
    }
    document.body.classList.add("spl-chrome");
    const BOOK = {
      "/rider": "/wiki/agent-rider",
      "/cuni": "/wiki/cuni",
      "/warrant": "/wiki/warrant",
      "/tollkeeper": "/wiki/tollkeeper",
      "/chamber": "/wiki/chamber",
      "/aos-ring": "/wiki/aos-ring",
      "/x402": "/wiki/x402",
      "/awlpay": "/wiki/awlpay",
      "/pcc": "/wiki/pcc",
      "/trustream": "/wiki/trustream",
      "/silesia": "/wiki/tnssrc",
      "/pulsar": "/wiki/pulsar",
      "/exactodds": "/wiki/exactodds",
      "/quikgater": "/wiki/quikgater",
      "/specialist": "/wiki/tru8",
      "/lab-pass": "/wiki/lab-pass",
      "/npm": "/wiki/packages",
    };
    const book = BOOK[path()];
    const main = document.querySelector("main");
    if (book && main && !main.querySelector(".spl-booklet")) {
      const note = document.createElement("p");
      note.className = "spl-note spl-booklet";
      note.innerHTML = `<a href="${book}">Read the full booklet in SlidWiki</a>`;
      main.appendChild(note);
    }
    if (!document.querySelector('script[src*="lab-auth.js"]')) {
      const s = document.createElement("script");
      s.src = "/assets/lab-auth.js?v=3";
      document.body.appendChild(s);
    }
    const btn = document.querySelector(".spl-nav-toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        document.querySelector(".spl-header")?.classList.toggle("open", !open);
      });
    }
  }

  function loadGa4() {
    var id = "G-R1T6T582B6";
    if (window.__splGa4) return;
    window.__splGa4 = id;
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", id);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
    (document.head || document.documentElement).appendChild(s);
  }
  loadGa4();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();
})();
