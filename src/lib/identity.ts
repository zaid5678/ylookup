import { ParsedStatement } from "./parse";

export type IdentityCheck = { field: string; a: string; b: string };

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

const normalize = normalizeName;

// Catches the "reconciled the wrong pair of documents" failure mode — e.g.
// diffing this quarter's statement against last quarter's, or one investor
// against another — before the line-item reconciliation runs at all.
export function checkIdentity(a: ParsedStatement, b: ParsedStatement): IdentityCheck[] {
  const mismatches: IdentityCheck[] = [];

  if (a.investorName && b.investorName && normalize(a.investorName) !== normalize(b.investorName)) {
    mismatches.push({ field: "Investor", a: a.investorName, b: b.investorName });
  }
  if (a.fundName && b.fundName && normalize(a.fundName) !== normalize(b.fundName)) {
    mismatches.push({ field: "Fund", a: a.fundName, b: b.fundName });
  }
  if (a.asOfDate && b.asOfDate && normalize(a.asOfDate) !== normalize(b.asOfDate)) {
    mismatches.push({ field: "Period / as-of date", a: a.asOfDate, b: b.asOfDate });
  }

  return mismatches;
}
