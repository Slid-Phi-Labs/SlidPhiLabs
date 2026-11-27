"""QLoRA fine-tune for Qwen2.5-7B-Instruct on the lab corpus (RTX 12GB path)."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from . import DEFAULT_BASE_MODEL
from .corpus import write_corpus


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="QLoRA train slid-llm")
    ap.add_argument("--base-model", default=os.environ.get("SLID_LLM_BASE", DEFAULT_BASE_MODEL))
    ap.add_argument(
        "--corpus",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data" / "corpus.jsonl",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "adapters" / "slid-llm-qlora",
    )
    ap.add_argument("--epochs", type=float, default=1.0)
    ap.add_argument("--max-steps", type=int, default=60)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--max-seq-len", type=int, default=1024)
    ap.add_argument("--rebuild-corpus", action="store_true")
    args = ap.parse_args(argv)

    if args.rebuild_corpus or not args.corpus.is_file():
        write_corpus(args.corpus)

    # Heavy imports stay inside main so unit tests can import the module shell.
    import torch
    from datasets import Dataset
    from peft import LoraConfig, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    if not torch.cuda.is_available():
        raise SystemExit("CUDA required for 7B QLoRA on this path")

    rows = [json.loads(line) for line in args.corpus.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not rows:
        raise SystemExit(f"empty corpus: {args.corpus}")

    def to_text(example: dict) -> dict:
        msgs = example["messages"]
        # Simple chat template fallback if tokenizer lacks apply_chat_template.
        parts = []
        for m in msgs:
            parts.append(f"<|{m['role']}|>\n{m['content']}")
        parts.append("<|assistant|>\n")
        return {"text": "\n".join(parts)}

    ds = Dataset.from_list(rows).map(to_text)

    bnb = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
    )
    tok = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb,
        device_map="auto",
        torch_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
    )
    model = prepare_model_for_kbit_training(model)

    def formatting(batch: dict) -> list[str]:
        texts = []
        for msgs in batch["messages"]:
            if hasattr(tok, "apply_chat_template"):
                texts.append(
                    tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)
                )
            else:
                texts.append(to_text({"messages": msgs})["text"])
        return texts

    lora = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )

    args.out.mkdir(parents=True, exist_ok=True)
    cfg = SFTConfig(
        output_dir=str(args.out),
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=args.lr,
        logging_steps=5,
        save_steps=max(args.max_steps, 1),
        bf16=torch.cuda.is_bf16_supported(),
        fp16=not torch.cuda.is_bf16_supported(),
        max_length=args.max_seq_len,
        report_to=[],
        dataset_text_field="text",
    )

    # Prefer messages formatting when TRL supports it; else plain text field.
    try:
        trainer = SFTTrainer(
            model=model,
            args=cfg,
            train_dataset=ds,
            peft_config=lora,
            processing_class=tok,
            formatting_func=formatting,
        )
    except TypeError:
        trainer = SFTTrainer(
            model=model,
            args=cfg,
            train_dataset=ds,
            peft_config=lora,
            processing_class=tok,
        )

    trainer.train()
    trainer.model.save_pretrained(args.out)
    tok.save_pretrained(args.out)
    meta = {
        "base_model": args.base_model,
        "corpus": str(args.corpus),
        "max_steps": args.max_steps,
        "epochs": args.epochs,
        "records": len(rows),
    }
    (args.out / "slid_llm_train.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"adapter saved -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
