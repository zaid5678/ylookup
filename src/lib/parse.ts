import { FIELD_ALIASES, FieldKey } from "./fields";

export type ParsedStatement = {
  fields: Partial<Record<FieldKey, number>>;
  // start/end are character offsets into the *original* text passed to
  // parseMultiStatement, so the UI can highlight the exact source line
  // regardless of which investor block it came from.
  raw: Record<FieldKey, { label: string; line: string; start: number; end: number } | undefined>;
  unmatchedLines: string[];
  investorName?: string;
  fundName?: string;
  asOfDate?: string;
};

export type MultiParsedStatement = ParsedStatement & { blockStart: number; blockEnd: number };

const NUMBER_RE = /\(?-?\$?\s?[\d,]+(?:\.\d+)?\)?%?/g;
const INVESTOR_LINE_RE = /^investor(?:\s*name)?\s*[:\-]\s*.+$/gim;

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

/**
 * Parse a single statement's worth of text. `baseOffset` shifts every
 * reported line's start/end so they stay valid character offsets into a
 * larger document when this text is a slice of one (see parseMultiStatement).
 */
export function parseStatement(text: string, baseOffset = 0): ParsedStatement {
  const rawLines = text.split("\n");
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

  let cursor = 0;
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    const lineOffsetInRaw = rawLine.indexOf(line);
    const start = baseOffset + cursor + (lineOffsetInRaw === -1 ? 0 : lineOffsetInRaw);
    const end = start + line.length;
    cursor += rawLine.length + 1; // +1 for the newline split() consumed

    if (!line) continue;

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
      raw[matchedKey] = { label: matchedKey, line, start, end };
    }
  }

  return { fields, raw, unmatchedLines, investorName, fundName, asOfDate };
}

/**
 * Split a document into one ParsedStatement per "Investor:" line found,
 * for documents that list a whole LP roster (a schedule of investors)
 * rather than a single investor's statement. A preamble before the first
 * investor line (shared fund name / as-of date / totals) is folded into
 * every block as a fallback. Falls back to a single whole-document parse
 * when there's 0 or 1 investor line, so single-investor statements behave
 * exactly as before.
 */
export function parseMultiStatement(text: string): MultiParsedStatement[] {
  const matches = [...text.matchAll(INVESTOR_LINE_RE)];

  if (matches.length <= 1) {
    return [{ ...parseStatement(text, 0), blockStart: 0, blockEnd: text.length }];
  }

  const preamble = parseStatement(text.slice(0, matches[0].index!), 0);

  return matches.map((match, i) => {
    const start = match.index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const parsed = parseStatement(text.slice(start, end), start);
    return {
      ...parsed,
      fundName: parsed.fundName ?? preamble.fundName,
      asOfDate: parsed.asOfDate ?? preamble.asOfDate,
      fields: { ...preamble.fields, ...parsed.fields },
      raw: { ...preamble.raw, ...parsed.raw },
      blockStart: start,
      blockEnd: end,
    };
  });
}
