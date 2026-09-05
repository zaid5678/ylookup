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
  line item's value), or a genuine break needing review. See
  [`src/lib/reconcile.ts`](src/lib/reconcile.ts).
- **Internal consistency check** — independently verifies each statement's
  own roll-forward (beginning + activity = ending) so an internally broken
  statement is caught even if it happens to "agree" with the other source.
- Runs entirely client-side; no statement data leaves the browser.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Load sample pair** to see it work on a
seeded example (a real-shaped discrepancy: a $37k unrealized-gain valuation
difference that cascades into the ending balance), or paste in your own two
statements as plain text.

## What's a demo shortcut right now

- Parsing works on labelled text (`Label: value` / `Label .... $ amount`
  per line), which covers pasted statement text or text extracted from a
  PDF — it does not do PDF table extraction itself yet.
- The field alias list covers the common capital-account line items; a real
  deployment would grow this from actual fund admin formats seen in the
  wild rather than guessing.
