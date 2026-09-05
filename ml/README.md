# Capital-account extractor (Tinker fine-tune)

The web app's parser (`src/lib/parse.ts`) matches line labels against a
fixed alias list. That works on the sample statements but will not survive
contact with real fund admin formats — different providers word, order, and
format the same 12 fields differently, and no alias list will cover all of
it. This trains a small model to do that extraction instead, generalizing
past whatever aliases we happened to think of.

**Status: pipeline built, not yet run.** It needs a Tinker API key, which
we don't have yet, and real training data, which the Saturday interviews
should provide. Everything here uses synthetic data as a placeholder so the
pipeline is ready to point at real statements the moment we have them.

## Pipeline

1. `generate_data.py` — synthesizes statement text (varied labels, currency
   formatting, field ordering, occasional missing fields) paired with the
   canonical JSON it should extract. Writes `data/train.jsonl` (2000
   examples) and `data/val.jsonl` (200 held out).
2. `train_extractor.py` — LoRA fine-tunes a base model (default
   `Qwen/Qwen3-8B`) via the Tinker API on that data, training only on the
   assistant turn (the JSON output), not the statement text itself.
3. `eval_extractor.py` — loads the resulting checkpoint, samples on the
   held-out set, and reports field-level accuracy. This is the gate before
   swapping the model in for the regex parser: it needs to beat the parser
   on the same set, not just "work."

## Running it

```bash
pip install tinker-cookbook

# Sign up at https://auth.thinkingmachines.ai/sign-up, create a key at
# https://tinker-console.thinkingmachines.ai, then:
export TINKER_API_KEY=...

python ml/generate_data.py
python ml/train_extractor.py
python ml/eval_extractor.py
```

## Swapping in real data

Replace the body of `make_example()` in `generate_data.py` (or just write
`data/train.jsonl`/`data/val.jsonl` directly) with real statement text paired
with analyst-verified JSON. The `{"messages": [...]}` shape and the field
list must stay the same, but nothing else in `train_extractor.py` or
`eval_extractor.py` needs to change — they're already pointed at
`data/*.jsonl`, not at the generator.

## Wiring into the app

Once a checkpoint clears the accuracy bar in `eval_extractor.py`, the
intended integration is a small extraction API route
(`src/app/api/extract/route.ts`, not yet built) that calls the Tinker
sampling client and returns the same `ParsedStatement` shape `parse.ts`
produces today, so `page.tsx` and `reconcile.ts` don't need to change —
only the parsing backend does.
