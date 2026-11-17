# Validation harnesses

Reproducible evidence kits. All three were syntax-checked and smoke-tested
(`bash -n`, `py_compile`, end-to-end analyzer run with hand-verified math).

- `bench.sh` + `analyze.py` — single-core (`taskset -c 0`) compression
  throughput: pulsar 2.5.0 and slid-phi vs zstd -19/-3, xz -6, lz4 on the
  Silesia corpus. 1 warm-up + 3 timed runs, median seconds, peak RSS via
  `/usr/bin/time -v`, SHA-256 round-trip every run. Outputs
  `bench-results.md` (paste into READMEs) and `bench-results.json`.
- `persist_swebench.py` — SWE-bench Lite leaderboard comparing baseline
  full-context retrieval vs PERsiST empty-start folding. Logs `pass_rate`,
  `avg_input_tokens`, `token_reduction_pct`, `median_turn_latency_ms`.
