# psi — development

Updated 2026-11-26. Source: `~/psi`, interlink doctor + SELL-KIT scorer example.

- Repo: github.com/ceedot-rock/psi, PUBLIC. 116 tweaks wired.
- Gate: `PSI-GREEN: quad complete, 116 wired` (bash doctor; needs
  `SLIDPHILABS_ROOT` or tools fail closed RED by design).
- Interlink doctor (Windows): **9/9 PASS** on Corey box — see
  [psi-doctor-windows-2026-11-26.md](./psi-doctor-windows-2026-11-26.md)
  (TOP100 #16).
- Proof: DEMO.md transcript real; retrieval scorer shipped; savings meter live.
- SELL-KIT: concrete scars>RAG retrieval example added locally in
  `~/psi/SELL-KIT.md` (+ docs-source); psi push blocked pending Corey go
  (TOP100 #18). Mirror below.
- Next milestone: HN Show HN posted (draft in `~/psi/HN-SHOWHN.md`),
  inbound harvested as surprises. Tweak 117 from the crowd.

## Retrieval scorer example (scars > RAG) — mirror of SELL-KIT

Why not just RAG? psi scores lab scars (observatory lessons with runnable
checks) by fit to the task — not embedding similarity / recency.

```sh
$ python retrieval/score.py observatory.jsonl "serve dev server sandbox"
6 [sandbox-limits] vite/wrangler dev die on uv_interface_addresses (blocked); plain node servers work; environmental, route around
3 [residue] serve scratch from temp dirs; seeds can rewrite tracked files (cuni-example.json): git checkout after
3 [hub-state] data/ gitignored in hub: server state there never pollutes repo
```

Top hit matches the task scar; scorer is `retrieval/score.py`. Re-verified
2026-11-26 on Win. Do not invent alternate scores.

## History

- 2026-11-26: TOP100 #16 — `python -m interlink doctor --peer muse` → 9/9
  PASS, home=`C:\Users\ptasz\.psi\a2a` (pathlib Windows-safe). Transcript
  filed under development/. No psi code fix needed; psi push still blocked.
- 2026-11-26: TOP100 #18 — concrete retrieval-scorer example (scars > RAG)
  patched into local `~/psi/SELL-KIT.md` + docs-source (unpushed) and mirrored
  here for ledger truth.
- 2026-10-16: quad wired + green gate; dressing (README, DEMO, CI).
- 2026-10-17/18: sets 118–175 (ship checklist, scope boxes, obs command).
- 2026-10-26: H100 compression results logged; PSI-by-default decree.
- 2026-10-27/28: winbox rewrite (env-model, traps, golden, usage meter).
- Gate has never gone red except the designed fail-close without env root.
