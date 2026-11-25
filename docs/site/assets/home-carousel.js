/* Homepage product carousel. Works without JS as a swipeable row; with JS:
   auto-advance every 6 s, pause on hover/keyboard focus/Pause button, arrows,
   product tabs, swipe, arrow/Home/End keys. Respects reduced motion. */
(function () {
  "use strict";
  const root = document.getElementById("hc");
  if (!root) return;
  const vp = root.querySelector(".hc-viewport");
  const track = root.querySelector(".hc-track");
  const slides = Array.from(track.children);
  const tabs = Array.from(document.querySelectorAll(".hc-tab"));
  const status = root.querySelector(".hc-status");
  const pauseBtn = root.querySelector(".hc-pause");
  const N = slides.length;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let i = 0, timer = null, hover = false, focus = false, paused = reduce;
  root.classList.add("js");

  function go(k, announce) {
    i = (k + N) % N;
    track.style.transform = "translateX(" + (-100 * i) + "%)";
    slides.forEach((s, j) => {
      const on = j === i;
      s.setAttribute("aria-hidden", on ? "false" : "true");
      s.querySelectorAll("a").forEach((a) => (a.tabIndex = on ? 0 : -1));
    });
    tabs.forEach((t, j) => { if (j === i) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current"); });
    if (announce !== false) status.textContent = slides[i].getAttribute("aria-label");
  }
  const bar = root.querySelector(".hc-progress i");
  function barReset(run) {
    if (!bar) return;
    bar.style.transition = "none"; bar.style.width = "0%";
    if (run) { void bar.offsetWidth; bar.style.transition = "width 6s linear"; bar.style.width = "100%"; }
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } barReset(false); }
  function start() {
    stop();
    if (paused || hover || focus || document.hidden) return;
    barReset(true);
    timer = setInterval(() => { go(i + 1, false); barReset(true); }, 6000);
  }
  function setPaused(p) {
    paused = p;
    pauseBtn.textContent = p ? "Play" : "Pause";
    pauseBtn.setAttribute("aria-label", p ? "Play the carousel" : "Pause the carousel");
    start();
  }

  root.querySelector(".hc-prev").addEventListener("click", () => { go(i - 1); start(); });
  root.querySelector(".hc-next").addEventListener("click", () => { go(i + 1); start(); });
  pauseBtn.addEventListener("click", () => setPaused(!paused));
  tabs.forEach((t, j) => t.addEventListener("click", (e) => {
    e.preventDefault(); go(j); start();
    root.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }));
  root.addEventListener("mouseenter", () => { hover = true; stop(); });
  root.addEventListener("mouseleave", () => { hover = false; start(); });
  root.addEventListener("focusin", (e) => {
    let kb = true; try { kb = e.target.matches(":focus-visible"); } catch { kb = true; }
    if (kb) { focus = true; stop(); }
  });
  root.addEventListener("focusout", (e) => { if (!root.contains(e.relatedTarget)) { focus = false; start(); } });
  vp.addEventListener("keydown", (e) => {
    const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: N - 1 }[e.key];
    if (k !== undefined) { go(k); e.preventDefault(); }
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  let x0 = null, y0 = null;
  vp.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; stop(); }, { passive: true });
  vp.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1));
    x0 = y0 = null; start();
  });
  // Greeting: first name when signed in to the lab.
  (async () => {
    if (!window.SPLAuth || !SPLAuth.me) return;
    let u = null;
    try { u = await SPLAuth.me(); } catch { u = null; }
    if (!u) return;
    const first = String(u.name || "").trim().split(/\s+/)[0];
    const hello = document.getElementById("hello");
    if (hello) hello.textContent = first ? "Welcome, " + first + "." : "Welcome back.";
    const lede = document.getElementById("lede");
    if (lede) lede.textContent = "Your account is ready. The same login opens every product below.";
    ["cta-account", "cta-top"].forEach((id) => { const a = document.getElementById(id); if (a) { a.textContent = "Go to your account"; a.href = "/account"; } });
  })();

  const h = location.hash.match(/^#hc-(\d+)$/);
  go(h ? Number(h[1]) - 1 : 0, false);
  if (reduce) setPaused(true); else start();
})();
