import { FIELD_LABELS, FIELD_ORDER, FieldKey, TIE_OUT_FORMULA } from "./fields";
import { ParsedStatement } from "./parse";

export type RowStatus = "match" | "rounding" | "explained" | "break" | "missing";

export type ReconRow = {
  key: FieldKey;
  label: string;
  a?: number;
  b?: number;
  diff?: number;
  pctOfBase?: number;
  status: RowStatus;
  explanation: string;
};

export type ToleranceConfig = {
  /** Below this absolute $ difference, treat as an exact match regardless of percentage. */
  absTolerance: number;
  /** Below this fraction of the larger value, treat as immaterial rounding rather than a break. */
  roundingPct: number;
};

export const DEFAULT_TOLERANCE: ToleranceConfig = {
  absTolerance: 0.01,
  roundingPct: 0.001, // 0.1%
};

function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function tieOut(fields: Partial<Record<FieldKey, number>>): number | null {
  const get = (k: FieldKey) => fields[k] ?? 0;
  const hasAny = TIE_OUT_FORMULA.some((k) => fields[k] !== undefined);
  if (!hasAny || fields.endingCapital === undefined) return null;
  // Distributions, fees, expenses, and carried interest are already stored
  // with their natural (negative) sign, so the roll-forward is a plain sum.
  const computed =
    get("beginningCapital") +
    get("contributions") +
    get("distributions") +
    get("managementFees") +
    get("partnershipExpenses") +
    get("netInvestmentIncome") +
    get("realizedGain") +
    get("unrealizedGain") +
    get("carriedInterest");
  return computed - fields.endingCapital;
}

export function reconcile(
  a: ParsedStatement,
  b: ParsedStatement,
  tolerance: ToleranceConfig = DEFAULT_TOLERANCE
) {
  const { absTolerance, roundingPct } = tolerance;
  const rows: ReconRow[] = [];

  for (const key of FIELD_ORDER) {
    const av = a.fields[key];
    const bv = b.fields[key];
    const label = FIELD_LABELS[key];

    if (av === undefined && bv === undefined) continue;

    if (av === undefined || bv === undefined) {
      rows.push({
        key,
        label,
        a: av,
        b: bv,
        status: "missing",
        explanation:
          av === undefined
            ? `Not reported in Source A — cannot confirm ${label.toLowerCase()} independently.`
            : `Not reported in Source B — cannot confirm ${label.toLowerCase()} independently.`,
      });
      continue;
    }

    const diff = av - bv;
    const base = Math.max(Math.abs(av), Math.abs(bv), 1);
    const pctOfBase = Math.abs(diff) / base;

    if (Math.abs(diff) <= absTolerance) {
      rows.push({ key, label, a: av, b: bv, diff, pctOfBase, status: "match", explanation: "Ties out." });
      continue;
    }

    // Does the variance exactly match another line item's value on either
    // side? That usually means one source folded a fee/expense into a
    // different bucket rather than there being a genuine error.
    let explained: string | null = null;
    for (const otherKey of FIELD_ORDER) {
      if (otherKey === key) continue;
      const otherA = a.fields[otherKey];
      const otherB = b.fields[otherKey];
      if (otherA !== undefined && Math.abs(Math.abs(diff) - Math.abs(otherA)) <= absTolerance) {
        explained = `Variance of ${fmtMoney(diff)} matches Source A's "${FIELD_LABELS[otherKey]}" (${fmtMoney(
          otherA
        )}) — likely classified under a different line item between sources.`;
        break;
      }
      if (otherB !== undefined && Math.abs(Math.abs(diff) - Math.abs(otherB)) <= absTolerance) {
        explained = `Variance of ${fmtMoney(diff)} matches Source B's "${FIELD_LABELS[otherKey]}" (${fmtMoney(
          otherB
        )}) — likely classified under a different line item between sources.`;
        break;
      }
    }

    if (explained) {
      rows.push({ key, label, a: av, b: bv, diff, pctOfBase, status: "explained", explanation: explained });
      continue;
    }

    if (pctOfBase <= roundingPct) {
      rows.push({
        key,
        label,
        a: av,
        b: bv,
        diff,
        pctOfBase,
        status: "rounding",
        explanation: `${fmtMoney(diff)} (${(pctOfBase * 100).toFixed(2)}%) — immaterial, consistent with rounding.`,
      });
      continue;
    }

    rows.push({
      key,
      label,
      a: av,
      b: bv,
      diff,
      pctOfBase,
      status: "break",
      explanation: `Unexplained variance of ${fmtMoney(diff)} (${(pctOfBase * 100).toFixed(
        1
      )}% of value) — needs analyst review.`,
    });
  }

  const tieOutA = tieOut(a.fields);
  const tieOutB = tieOut(b.fields);

  const summary = {
    total: rows.length,
    matches: rows.filter((r) => r.status === "match").length,
    rounding: rows.filter((r) => r.status === "rounding").length,
    explained: rows.filter((r) => r.status === "explained").length,
    breaks: rows.filter((r) => r.status === "break").length,
    missing: rows.filter((r) => r.status === "missing").length,
    tieOutA,
    tieOutB,
  };

  return { rows, summary };
}

export { fmtMoney };
