# slid-llm

Slid Phi Labs own local LLM. Fine-tune a 7B instruct model with QLoRA on public lab discovery text, then chat through a local Ollama (or OpenAI-compatible) host.

## What it does

- Builds a chat corpus from `docs/site/llms.txt`, `ai.txt`, agents/humans surfaces, plus refuse examples (no invented PERsiST rates, no invented x402 debits).
- QLoRA-trains `Qwen/Qwen2.5-7B-Instruct` on an RTX-class 12 GB GPU (4-bit).
- Serves via Ollama tag `slid-llm` or any `SLID_LLM_URL` OpenAI-compatible endpoint.
- Keeps PERsiST off sale in the system prompt. Lead order: PSI, then Rider.

## Install

```bash
cd packages/slid-llm
python -m pip install -e .
python -m pip install -e ".[train]"   # CUDA torch + peft/trl/bitsandbytes
```

Ollama should already have `qwen2.5:7b-instruct` (or pull it). Create the lab tag:

```bash
ollama create slid-llm -f Modelfile
```

## Usage

```bash
# rebuild corpus
python -m slid_llm.corpus

# QLoRA (GPU)
python -m slid_llm.train_qlora --rebuild-corpus --max-steps 60

# chat through local host
python -m slid_llm.host "What is the lead product?"
```

Environment:

- `SLID_LLM_URL` — default `http://127.0.0.1:11434`
- `SLID_LLM_MODEL` — default `slid-llm`
- `SLID_LLM_BASE` — HuggingFace base id for train

## Testing

```bash
python -m pytest tests -q
```

Offline unit tests cover corpus shape, refuse paths, and mocked host responses. Live generate against Ollama is optional and not required for GID EXEC.

## License

Dual-licensed AGPL-3.0-or-later OR Slid Phi Labs Commercial. See LICENSE and NOTICE.
