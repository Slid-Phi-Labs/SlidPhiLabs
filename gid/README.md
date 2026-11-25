# GID — Gap-ID Fix Betterment Loop

Standing process for scoring lab products 1–100, keeping standing records,
and closing gaps with smart fixes every run.

## The loop

1. **Score** every product in `products.registry.json` against [rubric.md](rubric.md) (10 checks x 10 pts = 100).
2. **Record** the run in `standings.jsonl` (append-only) and regenerate [STANDINGS.md](STANDINGS.md) (league table, best first).
3. **Fix** what failed: `safe` gaps are auto-applied, `proposed` gaps are logged for a human. Re-score after fixes so the standings show the betterment.

## Run it

```powershell
# Score + safe-fix everything, record standings
python SlidPhiLabs/gid/gid.py

# Score only (no writes except standings record)
python SlidPhiLabs/gid/gid.py --score-only

# One product only
python SlidPhiLabs/gid/gid.py --product phi-rest

# No fixes at all (audit mode)
python SlidPhiLabs/gid/gid.py --no-fix
```

## Files

| File | Role |
|------|------|
| `gid.py` | The GID runner: scores, finds gaps, applies safe smart fixes, writes standings |
| `products.registry.json` | Product list (name + path, `focus`, out-of-root `../` paths). Edit to add/remove products |
| `rubric.md` | The 1–100 rubric: 5 dimensions x 20 pts, 10 checks x 10 pts |
| `standings.jsonl` | Append-only, one JSON object per product per run (history is never rewritten; retired registry names simply leave the table) |
| `STANDINGS.md` | Generated league table ( standings, deltas, open gaps). Do not hand-edit |

## Smart-fix policy

- `safe` fixes create only additive boilerplate the repo already requires
  (`NOTICE`, `CHANGELOG.md`, minimal `README.md` stub). They never touch
  source logic, secrets, pricing, or versions.
- `proposed` gaps (missing tests, secrets hygiene, stale docs, unversioned
  packages) are written into the standings record with a concrete next step
  but left for a human. The runner never invents credentials, never publishes,
  never spends.
- Every fix is re-scored in the same run, so the recorded score is post-fix.

## Adding a product

Add one entry to `products.registry.json`:

```json
{ "name": "my-product", "path": "packages/my-product" }
```

Paths resolve from the `SlidPhiLabs/` repo root (`../` escapes to
siblings like the `psi/` tree). Two extensions:

- `focus: ["substring", ...]` — score one module inside a shared directory
  (e.g. one `.mjs` lib among many). Entry-source, test, secret, and
  placeholder checks scope to focus-matched files; manifest and license
  resolve upward to the owning project. Focus entries are audit-grade:
  GID scores them and proposes fixes but never writes stubs into a
  shared dir.
- Manifest lookup walks upward (module dir → owning project, stopping
  before the monorepo root, which packages nothing), and `LICENSE`
  counts when an owning parent carries it.
