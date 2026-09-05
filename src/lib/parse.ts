import { FIELD_ALIASES, FieldKey } from "./fields";

export type ParsedStatement = {
  fields: Partial<Record<FieldKey, number>>;
  raw: Record<FieldKey, { label: string; line: string } | undefined>;
  unmatchedLines: string[];
  investorName?: string;
  fundName?: string;
  asOfDate?: string;
};

const NUMBER_RE = /\(?-?\$?\s?[\d,]+(?:\.\d+)?\)?%?/g;

function parseNumber(token: string): number | null {
  let t = token.trim();
  if (!t) return null;
  const negative = t.startsWith("(") && t.endsWith(")");
  t = t.replace(/[()$,%\s]/g, "");
  if (!t || isNaN(Number(t))) return null;
  const n = Number(t);
  return negative ? -n : n;
}

function lastNumberOnLine(line: string): number | null {
  const matches = line.match(NUMBER_RE);
  if (!matches || matches.length === 0) return null;
  // The trailing number on a line is the value; labels can contain digits
  // (dates, fund codes) so we take the last match, not the first.
  for (let i = matches.length - 1; i >= 0; i--) {
    const n = parseNumber(matches[i]);
    if (n !== null) return n;
  }
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[_:]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Plain substring matching would let "realized gain" match inside
// "unrealized gain" — guard with a boundary so the char before the alias
// (if any) isn't a letter.
function containsAlias(norm: string, alias: string): boolean {
  const re = new RegExp(`(^|[^a-z])${escapeRe(alias)}`);
  return re.test(norm);
}

export function parseStatement(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fields: Partial<Record<FieldKey, number>> = {};
  const raw: ParsedStatement["raw"] = {} as ParsedStatement["raw"];
  const unmatchedLines: string[] = [];
  let investorName: string | undefined;
  let fundName: string | undefined;
  let asOfDate: string | undefined;

  const investorMatch = text.match(/investor(?:\s*name)?\s*[:\-]\s*(.+)/i);
  if (investorMatch) investorName = investorMatch[1].trim();
  const fundMatch = text.match(/^fund(?:\s*name)?\s*[:\-]\s*(.+)$/im);
  if (fundMatch) fundName = fundMatch[1].trim();
  const dateMatch = text.match(
    /(?:as of|statement date|period end(?:ing)?|quarter end(?:ing)?)\s*[:\-]?\s*([A-Za-z0-9,\/\- ]+)/i
  );
  if (dateMatch) asOfDate = dateMatch[1].trim();

  for (const line of lines) {
    const norm = normalize(line);
    let matchedKey: FieldKey | null = null;

    for (const key of Object.keys(FIELD_ALIASES) as FieldKey[]) {
      const aliases = FIELD_ALIASES[key];
      for (const alias of aliases) {
        if (containsAlias(norm, alias)) {
          matchedKey = key;
          break;
        }
      }
      if (matchedKey) break;
    }

    if (!matchedKey) {
      const isInvestorLine = investorMatch && line.includes(investorMatch[0]);
      const isFundLine = fundMatch && line.includes(fundMatch[0]);
      const isDateLine = dateMatch && line.includes(dateMatch[0]);
      if (!isInvestorLine && !isFundLine && !isDateLine) {
        unmatchedLines.push(line);
      }
      continue;
    }

    const value = lastNumberOnLine(line);
    if (value === null) continue;

    // If a more specific alias for this key already matched with a longer
    // label, prefer the first hit (aliases are ordered most-specific-first).
    if (fields[matchedKey] === undefined) {
      fields[matchedKey] = value;
      raw[matchedKey] = { label: matchedKey, line };
    }
  }

  return { fields, raw, unmatchedLines, investorName, fundName, asOfDate };
}
