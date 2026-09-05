import { normalizeName } from "./identity";
import { MultiParsedStatement } from "./parse";

export type InvestorPair = {
  key: string;
  label: string;
  a?: MultiParsedStatement;
  b?: MultiParsedStatement;
};

/**
 * Match investor blocks between two parsed documents by (normalized) name.
 * Most documents have exactly one investor per side, giving a single pair;
 * a "schedule of investors" document produces one pair per investor found
 * on either side, with a?/b? left undefined when an investor appears on
 * only one side (surfaced as its own thing to check, not silently dropped).
 */
export function pairInvestors(a: MultiParsedStatement[], b: MultiParsedStatement[]): InvestorPair[] {
  // Single-investor-per-side is the common case (or the no-investor-line
  // fallback) — pair positionally rather than by name match, since neither
  // side may even have parsed a name.
  if (a.length <= 1 && b.length <= 1) {
    const label = a[0]?.investorName ?? b[0]?.investorName ?? "Statement";
    return [{ key: "single", label, a: a[0], b: b[0] }];
  }

  const pairs: InvestorPair[] = [];
  const usedB = new Set<number>();

  for (const stmtA of a) {
    const key = stmtA.investorName ? normalizeName(stmtA.investorName) : null;
    const matchIdx = key ? b.findIndex((stmtB, i) => !usedB.has(i) && stmtB.investorName && normalizeName(stmtB.investorName) === key) : -1;
    if (matchIdx >= 0) usedB.add(matchIdx);
    pairs.push({
      key: key ?? `a-${pairs.length}`,
      label: stmtA.investorName ?? "Unnamed investor",
      a: stmtA,
      b: matchIdx >= 0 ? b[matchIdx] : undefined,
    });
  }

  b.forEach((stmtB, i) => {
    if (usedB.has(i)) return;
    pairs.push({
      key: stmtB.investorName ? normalizeName(stmtB.investorName) : `b-${i}`,
      label: stmtB.investorName ?? "Unnamed investor",
      a: undefined,
      b: stmtB,
    });
  });

  return pairs;
}
