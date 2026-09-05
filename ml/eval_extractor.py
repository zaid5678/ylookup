"""Field-level accuracy of the fine-tuned extractor against ml/data/val.jsonl.

This is the check that should gate swapping the trained model in for the
regex/alias parser: it has to beat the parser on the same held-out set
before it's worth the extra latency/cost of an LLM call. Run after
train_extractor.py has produced at least one checkpoint:

    python ml/eval_extractor.py --log_path /tmp/tinker-examples/capital_account_extractor
"""

import argparse
import asyncio
import json
from pathlib import Path

import tinker
from tinker import types
from tinker_cookbook import checkpoint_utils, renderers
from tinker_cookbook.tokenizer_utils import get_tokenizer

DATA_DIR = Path(__file__).parent / "data"
NUMERIC_TOLERANCE = 0.01


def load_val_examples():
    examples = []
    with open(DATA_DIR / "val.jsonl") as f:
        for line in f:
            row = json.loads(line)
            msgs = row["messages"]
            system = next(m["content"] for m in msgs if m["role"] == "system")
            user = next(m["content"] for m in msgs if m["role"] == "user")
            expected = json.loads(next(m["content"] for m in msgs if m["role"] == "assistant"))
            examples.append({"system": system, "user": user, "expected": expected})
    return examples


def fields_match(expected: dict, predicted: dict) -> tuple[int, int, list[str]]:
    correct, total, misses = 0, 0, []
    for key, exp_val in expected.items():
        total += 1
        pred_val = predicted.get(key)
        if exp_val is None:
            ok = pred_val is None
        elif isinstance(exp_val, (int, float)):
            ok = isinstance(pred_val, (int, float)) and abs(pred_val - exp_val) <= NUMERIC_TOLERANCE
        else:
            ok = isinstance(pred_val, str) and pred_val.strip().lower() == str(exp_val).strip().lower()
        if ok:
            correct += 1
        else:
            misses.append(f"{key}: expected {exp_val!r}, got {pred_val!r}")
    return correct, total, misses


async def main(log_path: str, model_name: str, renderer_name: str, limit: int):
    record = checkpoint_utils.get_last_checkpoint(log_path, required_key="sampler_path")
    if record is None:
        raise SystemExit(f"No checkpoint found under {log_path}. Run train_extractor.py first.")

    service_client = tinker.ServiceClient()
    sampling_client = await service_client.create_sampling_client_async(model_path=record.sampler_path)
    tokenizer = get_tokenizer(model_name)
    renderer = renderers.get_renderer(renderer_name, tokenizer)

    examples = load_val_examples()[:limit]
    total_correct, total_fields, exact_matches = 0, 0, 0

    for i, ex in enumerate(examples):
        convo = [
            {"role": "system", "content": ex["system"]},
            {"role": "user", "content": ex["user"]},
        ]
        model_input = renderer.build_generation_prompt(convo)
        result = await sampling_client.sample_async(
            prompt=model_input,
            num_samples=1,
            sampling_params=types.SamplingParams(max_tokens=512, temperature=0.0),
        )
        message, _termination = renderer.parse_response(result.sequences[0].tokens)
        content = message["content"]
        # content is normally a str; be defensive in case a renderer returns
        # a list of {"type": "text", "text": ...} parts instead.
        raw_text = content if isinstance(content, str) else "".join(
            p.get("text", "") for p in content if isinstance(p, dict)
        )

        try:
            predicted = json.loads(raw_text)
        except json.JSONDecodeError:
            predicted = {}

        correct, total, misses = fields_match(ex["expected"], predicted)
        total_correct += correct
        total_fields += total
        if not misses:
            exact_matches += 1
        elif i < 5:
            print(f"[example {i}] misses: {misses}")

    print(
        f"\nField-level accuracy: {total_correct}/{total_fields} "
        f"({100 * total_correct / total_fields:.1f}%)"
    )
    print(f"Exact-match statements: {exact_matches}/{len(examples)} ({100 * exact_matches / len(examples):.1f}%)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--log_path", default="/tmp/tinker-examples/capital_account_extractor")
    parser.add_argument("--model_name", default="Qwen/Qwen3-8B")
    parser.add_argument("--renderer_name", default="qwen3_disable_thinking")
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()
    asyncio.run(main(args.log_path, args.model_name, args.renderer_name, args.limit))
