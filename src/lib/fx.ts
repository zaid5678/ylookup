import { FieldKey } from "./fields";
import { ParsedStatement } from "./parse";

export type FxRate = { from: string; to: string; rate: number; date: string };

const cache = new Map<string, FxRate>();

/**
 * Live spot rate from the European Central Bank via frankfurter.dev — free,
 * no API key, no rate limit for this scale of use. Good enough to flag
 * "these two sources are in different currencies and here's roughly how
 * that reconciles"; not a substitute for the contractual FX rate a fund
 * actually used on a given valuation date if that matters for the review.
 */
export async function fetchFxRate(from: string, to: string): Promise<FxRate> {
  if (from === to) return { from, to, rate: 1, date: "n/a" };

  const key = `${from}->${to}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
  if (!res.ok) {
    throw new Error(`FX lookup failed (${res.status}) for ${from}->${to}`);
  }
  const data = await res.json();
  const rate = data?.rates?.[to];
  if (typeof rate !== "number") {
    throw new Error(`No rate returned for ${from}->${to}`);
  }

  const result: FxRate = { from, to, rate, date: data.date };
  cache.set(key, result);
  return result;
}

/** Multiply every numeric field by `rate`, converting a statement's amounts into another currency. */
export function convertStatement(stmt: ParsedStatement, rate: number): ParsedStatement {
  const fields: Partial<Record<FieldKey, number>> = {};
  for (const [key, value] of Object.entries(stmt.fields)) {
    if (value !== undefined) fields[key as FieldKey] = value * rate;
  }
  return { ...stmt, fields };
}
