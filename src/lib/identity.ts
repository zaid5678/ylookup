import { ParsedStatement } from "./parse";

export type IdentityCheck = { field: string; a: string; b: string };

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

const normalize = normalizeName;

// "June 30, 2026" and "06/30/2026" are the same date, just formatted
// differently by two different sources — compare calendar dates when we
// can parse both, and only fall back to string equality otherwise.
function datesMatch(a: string, b: string): boolean {
  if (normalize(a) === normalize(b)) return true;
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return false;
  return da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate();
}

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
  if (a.asOfDate && b.asOfDate && !datesMatch(a.asOfDate, b.asOfDate)) {
    mismatches.push({ field: "Period / as-of date", a: a.asOfDate, b: b.asOfDate });
  }

  return mismatches;
}
