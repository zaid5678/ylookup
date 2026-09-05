# Capital Account Reconciler

A narrow tool for a real fund-ops problem: two sources describing the same
LP capital account (fund admin statement, LP's own record, custodian feed,
prior-quarter roll-forward) almost never agree on the first pass, and an
analyst has to work out, line by line, whether each gap is a rounding
artefact, a labelling/classification difference, or an actual break that
needs chasing.

This does that reconciliation automatically:

- **Semantic field matching** — recognizes the same line item across
  different label conventions (e.g. "Beginning Capital Account Balance" vs
  "Opening Balance") via an alias table in [`src/lib/fields.ts`](src/lib/fields.ts).
- **Variance classification** — each line is marked as a match, immaterial
  rounding, a likely reclassification (the variance exactly matches another
  line item's value), or a genuine break needing review, with configurable
  tolerance thresholds. See [`src/lib/reconcile.ts`](src/lib/reconcile.ts).
- **Internal consistency check** — independently verifies each statement's
  own roll-forward (beginning + activity = ending) so an internally broken
  statement is caught even if it happens to "agree" with the other source.
- **PDF upload** — extracts text from PDF statements client-side
  ([`src/lib/pdf.ts`](src/lib/pdf.ts)), alongside pasted text or `.txt`
  files.
- **Cross-document identity check** — flags investor/fund/date mismatches
  between the two sources before running the reconciliation, so you don't
  waste time diffing the wrong pair of documents.
- **Multi-investor documents** — a "schedule of investors" listing several
  LPs in one file is split and paired by investor name
  ([`src/lib/pairing.ts`](src/lib/pairing.ts)), with a tab per investor.
- **Source traceability** — click any reconciliation row to highlight the
  exact line it came from in both source panels.
- **Exportable report** — one click copies the reconciliation as Markdown,
  ready to paste into an email or ticket.
- Runs entirely client-side; no statement data leaves the browser.

## Running it

```bash
npm install
npm run dev   # app
npm test      # unit tests (vitest) for the parsing/reconciliation logic
```

Open http://localhost:3000, click **Load sample pair** to see it work on a
seeded example (a real-shaped discrepancy: a $37k unrealized-gain valuation
difference that cascades into the ending balance), or paste in your own two
statements as plain text or upload a PDF/.txt file.

## What's a demo shortcut right now

- Parsing works on labelled text (`Label: value` / `Label .... $ amount`
  per line), which covers pasted statement text or text extracted from a
  PDF — it does not do arbitrary PDF *table* extraction (multi-column
  layouts) yet.
- The field alias list covers the common capital-account line items; a real
  deployment would grow this from actual fund admin formats seen in the
  wild rather than guessing. See [`ml/`](ml/) for a fine-tuning pipeline
  (via [Tinker](https://tinker-docs.thinkingmachines.ai/)) intended to
  replace this alias list with a model trained on real statements.
