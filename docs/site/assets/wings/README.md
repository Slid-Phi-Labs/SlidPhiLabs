# Wings / creator art

Public art for the Nov 15, 2026 restore. Paths are stable so Design can swap files in place later.

## Where each file came from

- `mark/`, `favicon/`, `app-icon/` — Design's finished vector mark, wordmark, favicon, and app icons, copied from `/workspace/slidphi-design-assets/` on 2026-11-15.
- `hero/` — optimized 1280 / 1600 / 2400 crops (AVIF, WebP, JPEG) from Design's landscape composite `work/hero-composite-2400.png`. The `hero/` folder in Design's pack was still empty, so these are derived from that work file, not a raw dump of the 1.24 MB master poster.
- `phone/` — face-and-wings portrait crops from the same Design composite, without the Zero-Range-Wave banner (Design's `phone/` stills still carried that banner and were over 250 KB). WebP stays under ~230 KB.
- `og/` — 1200×630 and 2400×1260 from the same composite.
- `fonts/` — Cinzel 600/700 as self-hosted WOFF2, from Design's TTF, so the site does not need Google Fonts (the CSP does not allow it).

To replace a crop, keep the filename, width, and format. Prefer AVIF/WebP plus a JPEG fallback. Do not check in `brand/slid-phi-labs-master.jpg` as a page background.
