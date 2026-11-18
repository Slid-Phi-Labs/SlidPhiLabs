# Agent-data compression methods — Tavily research pass 2026-11-12

Type: research synthesis (full-text reads only; snippet-only items dropped, listed at the end).
Project: agent-data compression harness (Corey order 2026-11-12: beat the best baseline by 10% on agent data).
Supersedes nothing; append-only. Raw pulls in `pulls.jsonl` (50 records, 10 basic queries, 2026-11-12).

## Definitions (terms fixed before use)

- **Agent data**: the bytes an agent session actually stores — JSON tool-call
  transcripts (JSONL), conversation histories / trajectories, context-window
  dumps, mixed code+prose. Structure is semi-regular: fixed schemas, repeated
  keys, repeated tool names, repeated system prompts; values vary.
- **Compression ratio** here means `compressed_bytes / raw_bytes` unless a
  source states otherwise. A source's "compression ratio 249x" means
  `raw / compressed`. Both forms are labelled per number below.
- **Dictionary** (two senses, kept apart): (a) an LZ adaptive dictionary —
  the sliding window a compressor builds as it goes; (b) a **preset /
  trained dictionary** — bytes supplied before compression starts, shared
  across many small inputs, counted once.
- **Lossless** = byte-exact round trip (SHA-256 verified). The harness is
  lossless by order; lossy history summarization is out of scope, not a
  competitor.
- **Adjusted compression rate** (DeepMind): `(compressed_bytes +
  model_bytes) / raw_bytes`. A neural compressor that ignores its model size
  is reporting a raw rate, not what you pay.

## What agent data is, as a compression problem (measured, not asserted)

- Kundi et al. (EMSE 2020), 12 general compressors on 9 log files vs natural
  language: general compressors reach **17.07–249.44x** (raw/compressed) on
  log data vs **4.62–5.00x** on natural language. Logs are semi-structured:
  fixed components (timestamps, levels) plus free-form bodies, with lines
  from the same logging statement identical except for dynamic fields.
  Agent transcripts have the same shape: fixed schema + varying values.
- Same study: the compressor with the best ratio on natural language is
  rarely the best on log data — and the best-on-logs compressors are rarely
  the ones logging tools actually adopt. Corollary for this project: do not
  import a general-text ranking; measure on agent data.
- Lemire (2021), twitter.json 617 KB at default levels: gzip 51 KB (8.3%),
  zstd 48 KB (7.8%). Decompression: gzip 175 MB/s, libdeflate 424 MB/s,
  zstd 360 MB/s. JSON is already ~12x compressible by a plain LZ codec;
  the 10% target must come from structure the LZ pass leaves behind.
- zstd issue #97 (KrzysFR, 2015, document store): individual JSON documents
  sharing a schema compress only **10–20%** alone, but batches of tens to
  hundreds reach **10x–50x** — the redundancy is *between* documents
  (schema, field names, constants, frequent values), not within one.

## Candidate 1 — Trained preset dictionary + schema shredding (MOST PROMISING)

**Mechanism.** Train one dictionary from a sample of the corpus (zstd
`--train`, or a hand-built "hollow" schema: the JSON skeleton with values
stripped), then compress every record/turn against it. The dictionary
absorbs the format grammar — keys, punctuation, tool names, constants —
so the codec spends its bits on values only. Optionally shred first:
replace repeated keys/values with small integer IDs (columnar dictionary
encoding) and hand the ID streams to the codec.

**Evidence (full-text reads).**
- PMTiles discussion #323 (measured, ~2,000 map tiles, raw 1,229,249 B):
  plain zstd 952,206 B; +8 KB trained dict 825,730 B = **0.867x vs zstd
  (13.3% smaller)**; +128 KB dict 816,892 B = 0.858x. Gains flatten past
  8 KB. Dictionary contents: mostly layer names, tag names, common values
  — the exact analogue of agent-data keys/tool names.
- zstd #97: femtozip (dictionary-training compressor) compressed 1,000
  individual documents at the **same ratio as batch gzip -5** — the
  dictionary recovers the whole cross-document gain for isolated records.
  Hollow-JSON gen0 dict (`{ "id": , "foo": "", ... }`) measurably shrank
  single documents; the residual literal stream was exactly the
  document-specific content (`123HelloWorld`).
- RocksDB preset-dictionary blog (production): preset dicts give measured
  benefit on data blocks **up to 16 KB**; typical dict 16 KB; zstd train
  bytes guided at **100x dict bytes**. Digested dictionaries
  (`ZSTD_CDict`/`ZSTD_DDict`) remove per-call deserialization cost and can
  *reduce* decompression CPU.
- DebugBear (measured, Bootstrap CSS 232,803 B raw): zstd-19 without dict
  26,035 B → **6,118 B with prior version as dict (23.5% of no-dict
  size, 2.63% of raw)**. Brotli 5: 28,250 → 7,217 B. Dict gains start at
  Brotli 5+ / zstd 3+.

**Why it should help on agent data.** Agent data's dominant redundancy is
exactly what a trained dict captures: a small fixed schema repeated
thousands of times, plus a small vocabulary of tool names, roles, and
status strings. It is C-native (zstd), fast, and the dictionary is a
one-time amortized cost.

**Falsifier.** If on the real agent corpus a trained dict + zstd-19 does
not beat bare zstd-19 by >10% (or the dict must exceed ~64 KB to do so),
the gain is a small-record artifact and this candidate drops to a
preprocessing step only.

**Caveats (measured).** RocksDB: a dictionary trained on an *adjacent*
file is "substantially worse" than one trained on the same file it
compresses — the dict must match the distribution it serves; stale or
cross-session dicts decay. zstd #97: gains above 128–256 KB blocks are
unproven (dict inserted for the first block only) — irrelevant for
turn-sized records, relevant for whole-session blobs.

## Candidate 2 — Cross-turn delta: prior turn/session as the dictionary

**Mechanism.** Compress turn N (or session snapshot N) using turn N−1 as
the preset dictionary (zstd `ZSTD_compress_usingDict` with the previous
raw bytes, or RFC 9842 Compression Dictionary Transport semantics
locally). Agent sessions are successive near-copies: same system prompt,
same tools, growing history with small appends. The compressor then
emits only the diff.

**Evidence (full-text reads).**
- Cloudflare (lab test, 200 runs, San Jose PoP): 272 KB JS bundle →
  gzip 92.2 KB → **DCZ with prior version as dict 2.6 KB (99% off raw,
  97% smaller than gzip)**. Live demo: 94 KB bundle redeployed per minute
  → **~450 bytes (99.5% reduction over gzip)** — the wire carries only
  the actual diff. Same post: agentic actors were just under 10% of
  Cloudflare requests in March 2026, up ~60% year-over-year — agents
  re-fetch near-identical content constantly.
- DebugBear table (same numbers as Candidate 1): prior-version-as-dict
  is the mechanism behind the 6,118 B zstd-19 figure.

**Why it should help on agent data.** A trajectory is a chain of
near-duplicate states; each turn's context is the previous turn's context
plus one exchange. This is the largest single measured gain in the whole
pass (97% smaller than gzip on near-duplicate data) — if the harness
stores sessions as chains, this dominates.

**Falsifier.** If turns in the real corpus share <50% of bytes with their
predecessor (e.g. sessions are independent one-shots, or tool outputs are
large fresh blobs), the delta gain collapses to Candidate 1's level and
the chaining machinery is not worth its complexity. Measure pairwise
turn similarity first.

**Cost.** The decoder needs the predecessor (chain dependency); random
access to turn K requires the chain or periodic keyframes. Design
decision, not a disqualifier — same trade as video keyframes.

## Candidate 3 — Pattern-grouped token encoding (DeLog-style)

**Mechanism.** Do not parse perfectly; group tokens by compressible
property and encode each group with its own coder: timestamps/sequence
numbers → delta encoding; pure numbers → elastic (MSB-terminated variable
length) encoding; highly repetitive strings → dictionary-ID encoding.
Templates stored once.

**Evidence (full-text reads).**
- DeLog (Yu et al., arXiv 2601.15084, 16 public + 10 production datasets,
  >100M lines / 100 GB): **1.09–1.45x compression-ratio improvement over
  baselines on public benchmarks**, 1.87–21.52x faster compression;
  production logs 1.13–1.38x ratio, 1.72–28.84x faster compression.
  DeLog-L variant: decompression **1.19–292.47x faster** than baselines
  at comparable ratio.
- DeLog's central empirical finding, directly relevant to us: **higher
  parsing accuracy does NOT guarantee a better compression ratio.**
  What drives ratio is optimal pattern-based grouping and encoding —
  partitioning tokens into low-entropy, highly compressible groups
  (value locality, structural predictability such as monotonic increase).
  Prior art LogReducer: 1.3–5.3x over LZMA on public benchmarks, but
  only **1.1x on production data** — public-benchmark gains do not
  transfer to messy real data. Our corpus is real agent data; expect the
  production-side numbers, not the public ones.
- Kundi et al.: PPMD achieves the highest compression ratio on log data
  of the 12 compressors tested, and is only 41.5–60.6% slower than LZ77
  on logs (vs 66.2–71.3% slower on natural language); PPMD compression
  speed on logs 15.64–33.33 MB/s. BWT/PPMD ratios rise up to 234.93% /
  204.85% with level on logs vs 16.39% / 17.44% on natural language.
  Default levels are usually not optimal for logs; PPMD's best combined
  score sits at levels 5–8. 128 KB blocks are a good ratio/speed tradeoff
  for LZ77/BWT; PPMD prefers large sizes.

**Why it should help on agent data.** Agent transcripts are token
streams with obvious compressible groups: timestamps, token counts,
message IDs (monotonic), roles/tool names (tiny vocabulary), code vs
prose. Grouping them before the entropy coder is the same win DeLog
measures, without needing a perfect JSON parser.

**Falsifier.** If a grouping pass + zstd-19 does not beat bare zstd-19 by
>10% on the real corpus, the groups were not low-entropy enough (e.g.
values dominate and are high-entropy) and this candidate is dropped.

## Candidate 4 — PPM / context mixing (the ratio ceiling; speed-limited)

**Mechanism.** Predict each next bit/symbol from long contexts and mix
predictions from many models (linear or logistic mixing with adaptive
weights), then arithmetic-code. PPM uses the longest matched context,
falling back to shorter ones; context mixing (PAQ/cmix) combines
independent models — word models, match models, sparse/gapped contexts,
and (in cmix) neural/LSTM mixers.

**Evidence (full-text reads).**
- Large Text Compression Benchmark (Mahoney, enwik9 = 1,000,000,000 B,
  updated Oct 14, 2026): **cmix v21 107,963,380 B** (+281,387 B
  decompresser = 108,244,767 total); cmix-obias 108,009,834 B;
  paq8px 124,696,410 B; zpaq 142,252,605 B; ppmonstr (PPM) 157,007,383 B;
  **xz 5.2.1 (preset 9e, 1 GiB dict) 197,331,816 B**;
  **zstd 0.6.0 -22 --ultra 215,674,670 B**. Context mixing beats the xz
  baseline by ~45% and zstd by ~50% on enwik9. Top entry is now a
  Transformer (ex-girlfriend, 91,778,237 B).
- Costs from the same table: cmix ~119,920 ns/byte compression
  (~8 KB/s), ~9.8 GB memory; paq8px ~291,916 ns/byte, 28 GB memory;
  ppmonstr PPM ~3,574 ns/byte, 1.7 GB. xz is ~5,876 ns/byte.
  Context mixing is 20–50x slower than xz and ~1,000x slower than zstd
  at these settings.
- Wikipedia (context mixing): logistic mixing transforms predictions to
  log-odds, averages with adaptive weights, squashes back; weights adapt
  by prediction error with learning rate typically 0.002–0.01. PAQ7+
  and cmix use logistic mixing; earlier PAQ used linear.
- Kundi et al.: PPMD is the best-ratio general compressor on log data
  (see Candidate 3 numbers) — prediction-based methods specifically
  favor this data class over LZ77/BWT.

**Why it could help on agent data.** Agent data has long-range,
high-order structure (repeated tool-call templates, repeated system
prompts hundreds of KB apart) that short-window LZ cannot see but
order-5+ PPM / match models can. The LTCB gap (cmix 108 MB vs xz
197 MB) is the largest proven headroom over our baselines anywhere in
this pass.

**Falsifier / applicability.** The full cmix/paq8px stack is not a
credible build target for a harness that must run at sane speed and
memory. The applicable form is a *small* context mixer or PPMD-class
coder tuned to agent data (e.g. zpaq-style order 0–5 ICM chain, or
PPMd with a large model), benchmarked against xz-6/zstd-19 on the real
corpus. If a small mixer cannot beat xz-6 by >10% at <10x xz-6's time,
it stays a reference point, not the build.

## Candidate 5 — Small neural LM + arithmetic coding (WATCH, not build)

**Mechanism.** A language model supplies P(next token | context); an
arithmetic coder converts those probabilities to bits at ~−log2(p) bits
per token. Better prediction = fewer bits (Shannon 1948).

**Evidence (full-text reads).**
- DeepMind, "Language Modeling Is Compression" (arXiv 2309.10668):
  Chinchilla 70B raw rates — ImageNet patches **43.4% vs PNG 58.5%**,
  LibriSpeech **16.4% vs FLAC 30.3%** (model size *excluded*). Adjusted
  rate: model size must be counted; a foundation model only achieves
  non-trivial adjusted compression on datasets of TB scale. Small
  Transformers trained on enwik8: 38M params, ASCII tokenizer,
  **6.4% raw rate on enwik9**; BPE tokenizers *hurt* larger models
  (BPE-20K: 9.0% vs ASCII 6.4%). Tokenization is itself a
  pre-compression. Context length limits offline compression to a few KB
  per chunk.
- SMLL (SmolLM2-360M + arithmetic coding, measured by the author):
  JSON **7.86x vs gzip 2.72x / zstd 2.66x**; LLM-generated text 14.96x
  vs gzip 1.89x; Wikipedia 14.83x; Python code 10.48x. But: UUIDs
  **0.94x** (expansion — random data is unpredictable by anything);
  throughput **700 chars/s vs gzip 6,500,000 chars/s (~10,000x
  slower)**; 1 MB takes ~25 minutes; model is 200 MB and must be
  identical on both ends.

**Verdict: REJECTED for this build.** The raw ratios are the best in the
pass, but the adjusted rate kills it at harness scale (a 200 MB model
amortized over a corpus that is not TB-scale), throughput is four orders
of magnitude off, and it fails exactly on the high-entropy fields agent
data is full of (UUIDs, hashes, tokens). Keep as a research watch: a
tiny distilled model trained *on agent data* could in principle become
Candidate 4's mixer, but that is a separate project with its own
training cost.

## What does NOT work on this data class (measured reasons)

- **Lossy history compression** (summarization, truncation, TLDR-ing:
  Koog docs, mem0, StateComp arXiv 2609.27298, Factory eval). It
  shrinks token counts for inference, but it changes the bytes. The
  harness requires exact round-trip; lossy methods are a different
  product, not a competing codec. REJECTED by scope, not by ratio.
- **Random / high-entropy fields are incompressible by any method.**
  SMLL: UUIDs 0.94x (the model *expands* them); gzip/zstd manage only
  1.71–1.76x on UUIDs, and that is mostly the fixed hex alphabet, not
  the random bits. Any method whose win depends on predicting IDs,
  hashes, or auth tokens will fail on real agent data. Design must
  isolate high-entropy fields, not try to predict them.
- **Generic pretrained dictionaries, applied blindly.** RocksDB
  (production): a dictionary trained on an adjacent file is
  "substantially worse" than same-file training. zstd #97: dictionary
  benefit past 128–256 KB blocks is unproven (dict inserted for first
  block only). A dict is only as good as its match to the distribution
  it serves; a stale or foreign dict is dead weight the decoder must
  still carry.
- **Counting the model but not the dictionary (or vice versa).**
  DeepMind's adjusted-rate argument applies to dictionaries too: a
  100 KB dict amortized over a 1 MB corpus is a 10% tax. Every
  candidate's numbers above must be re-measured *including* the dict /
  model / table bytes, on the real corpus. The 10% target is on total
  stored bytes.
- **Public-benchmark gains do not transfer to production-shaped data.**
  DeLog: LogReducer 1.3–5.3x over LZMA on public benchmarks, 1.1x on
  production logs. Any candidate justified only by a public corpus is
  unproven until measured on real agent data.

## Dropped / unverified (snippet-only, NOT cited)

- BTH/Ericsson thesis ("Efficient Compression of XML and JSON Event Log
  Records"): snippet numbers (Dictionary 91.7% avg, Zstd 84.7%, EVTX
  92.7% Zstd) — the PDF returned HTTP 403 on full-text fetch 2026-11-12.
  Dropped per the no-snippet rule. Revisit only if the full text becomes
  readable; its dictionary-vs-zstd comparison would be directly relevant.
- Lemire's "Brotli compresses JS/JSON 5–30% better than zstd" — present
  in the search snippet but absent from the fetched full text of the same
  post. Not cited. Brotli remains a legitimate *measured baseline* in the
  harness; the 5–30% figure is not evidence.
- SpeedVitals (500 MB JSON: Brotli 87.8% in 759 s vs zstd 81.68% in
  0.5 s), Adaltas (Wikimedia JSON gzip 92% / bzip 95%), Codelit/BlazingCDN/
  MironSoft Brotli-vs-zstd tables, HN anecdotes (zstd ~30x vs gzip ~15x
  on JSON), Sequence Memoizer / CS772 report, ScyllaDB SSTable dict docs,
  VLDB columnar-formats paper, Parquet/MotherDuck dictionary-encoding
  pages — surfaced by Tavily, not read in full, not cited. Several are
  worth full reads in a second pass if the build needs them (notably the
  VLDB columnar paper for the shredding design).
- cmix author page (byronknoll.com/cmix.html): blocked by fetch policy
  2026-11-12; LTCB table used instead for cmix numbers.

## Bottom line for the build

Ranked by expected (ratio gain × feasibility) on real agent data:

1. **Trained preset dictionary + schema shredding, over zstd-19** —
   cheapest, C-native, measured 13% (small dict) to 76% (prior-version
   dict) improvements over bare zstd in adjacent domains. Build first.
2. **Cross-turn delta (prior turn as dictionary)** — largest measured
   gain anywhere (97% smaller than gzip on near-duplicates); needs a
   turn-similarity measurement on the real corpus before committing to
   chain storage.
3. **Pattern-grouped token encoding (DeLog-style)** — 1.09–1.45x over
   baselines on public logs; the grouping insight (not parsing accuracy)
   is the design lesson. Combine with (1): group, then dict+zstd.
4. **Small PPM / context mixer (PPMd / zpaq-class)** — the ratio ceiling
   (cmix beats xz by ~45% on enwik9) but at 20–50x xz's time; build a
   small tuned variant and measure, do not port cmix.
5. **Neural LM + arithmetic coding** — best raw ratios, rejected for
   this build on adjusted rate + 10,000x slowdown + failure on random
   fields. Watch only.

First measurement the build needs (before any codec work): pairwise
byte-similarity between consecutive turns in the real corpus, and the
per-field entropy profile (keys vs values vs IDs). Those two numbers
decide between candidates 1 and 2 and size the dictionary.

## Sources (all read in full text 2026-11-12)

- Mahoney, Large Text Compression Benchmark, mattmahoney.net/dc/text.html
  (updated Oct 14, 2026) — enwik9 table.
- Wikipedia, "Context mixing" — mechanism (linear/logistic mixing).
- Lemire, "Compressing JSON: gzip vs zstd", lemire.me, 2021-06-30.
- Kundi, Yao, Li, Shang, Hassan, "A Study of the Performance of General
  Compressors on Log Files", EMSE 2020 (ece.uwaterloo.ca PDF).
- Yu et al., "DeLog: An Efficient Log Compression Framework with Pattern
  Signature Synthesis", arXiv 2601.15084v1.
- Delétang et al., "Language Modeling Is Compression", arXiv 2309.10668v2.
- Chiarulli, "SMLL: Using 200MB of Neural Network to Save 400 Bytes",
  frankchiarulli.com.
- RocksDB blog, "Preset Dictionary Compression", 2021-05-31.
- facebook/zstd issue #97 (KrzysFR, 2015) — hollow-JSON dict, femtozip.
- protomaps/PMTiles discussion #323 — measured 8 KB dict, 13% gain.
- DebugBear, "The Ultimate Guide to Shared Compression Dictionaries".
- Cloudflare blog, "Shared Dictionaries: compression that keeps up with
  the agentic web" (RFC 9842, DCZ measurements).
