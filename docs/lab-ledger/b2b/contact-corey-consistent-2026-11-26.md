# Contact corey@slidphilabs.com consistent — 2026-11-26

TOP100 #65. Public HTML/txt surfaces only.

## Grep (docs/site)

Patterns: `gmail.com`, `nektaronbase`, `ptasz@`, `ceedot@`, `hello@slid`, `info@slid`, `founder@`, `sales@`, `support@` on `*.html` / `*.txt` → **no matches**.

All `mailto:` hits sampled (about, access, contact, consulting, pps, press, privacy, terms, status, humans.txt, ai.txt, llms.txt, …) use `corey@slidphilabs.com`.

## Live spot-check

- `GET https://www.slidphilabs.com/humans.txt` → `Contact: corey@slidphilabs.com` (200)
- `/contact.html` meta + CTA → corey@slidphilabs.com
- `/ai.txt` → `Inbox — corey@slidphilabs.com`

## Out of scope (not public HTML/txt)

- `docs/site/SITE_DOWN_FIX.md` mentions Vercel team name `nektaronbase-cells-projects` (ops note, not a contact email). Left alone per “HTML/txt surfaces only”.

## Verdict

Already consistent. Mark #65 DONE. No public surface fix required.
