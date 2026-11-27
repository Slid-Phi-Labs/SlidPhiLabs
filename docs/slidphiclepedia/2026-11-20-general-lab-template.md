# General Lab — template generalization from biolab (2026-11-20)

The biolab frame (`~/workspace/biolab/`) is generalized into the ultimate
general research lab (`~/workspace/general-lab/`). Same 3-agent loop
(SCOUT → SKEPTIC → SYNTHESIZER), same report protocol, same stop rules,
same compressor — domain removed, nothing else.

## What changed vs biolab
- **Domain: none.** No biomedical wording anywhere. Candidates are
  technologies/approaches, not drugs.
- **Kill criteria K1–K6: same structure, general wording.** K1 = falsifier
  observed in primary evidence; K2 = fewer than 2 independent sources
  after source-checking; K3 = unfalsifiable falsifier; K4 = mechanism
  contradicts established science/engineering with no bridging evidence;
  K5 = out of scope; K6 = weak evidence only after two passes.
- **Scope guard: general safety floor only.** No bioweapon/pathogen/toxin
  work, no synthesis of hazardous material, no illicit instructions. No
  domain restriction.
- **Default question:** grid-scale battery chemistries beyond
  lithium-ion — the Mesh energy loop's first mission. Benchmark frozen
  before pass 1: 3 candidates, each mechanism + ≥2 independent sources +
  stated falsifier; breakthrough = convergent evidence + novel
  mechanistic link.

## What stayed identical
- 3 roles and their output formats; 7-section report protocol; benchmark
  frozen before pass 1 (byte-identical check); stop rules (CONTINUE /
  BENCHMARK MET / BREAKTHROUGH / ALL KILLED, max 6 passes, 2
  consecutive failed passes = stall); compress.py (deterministic
  distiller, 4,000-token budget, lossless on claims/numbers/citations,
  lossy on prose); pluggable LLM backend via env keys only (Groq /
  Anthropic / OpenAI-compatible, fails loudly with no key); dry-run
  redirect fix (dry runs write report-dryrun.md and never overwrite the
  live report.md).

## Record
- Build + live pass 1: `~/workspace/general-lab/BUILD-LOG-2026-11-20.md`
- What-changed-vs-biolab detail: `~/workspace/general-lab/TEMPLATE-NOTES.md`
- Template source: `~/workspace/biolab/` (runner.py 893 lines,
  agents/scout.md, agents/skeptic.md, agents/synthesizer.md,
  report-protocol.md, compress.py, config.yaml, README.md)
