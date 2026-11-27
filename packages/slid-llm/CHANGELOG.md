# Changelog

## 0.2.0 — 2026-11-27

- First shippable slid-llm package: corpus builder from public discovery files,
  QLoRA trainer for Qwen2.5-7B-Instruct, Ollama/OpenAI-compatible host client,
  refuse paths for empty prompts and unsafe lab requests, pytest suite wired
  for GID EXEC, Modelfile for local `slid-llm` tag, dual-license NOTICE.
- Local RTX 5070 QLoRA receipt: 60 steps on 41 corpus rows, train_loss ~1.19,
  final mean_token_accuracy ~0.93; adapter lands under `adapters/slid-llm-qlora`
  (gitignored weights). Ollama tag `slid-llm` serves the system-prompt host.
- GID: registered product scored 100 (gaps none) across betterment + 11
  score-only passes.

## 0.1.0 — 2026-11-27

- Scaffold only (superseded the same day by 0.2.0).
