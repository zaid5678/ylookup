import { fmtMoney, ReconRow } from "./reconcile";

const STATUS_LABEL: Record<ReconRow["status"], string> = {
  match: "Match",
  rounding: "Rounding",
  explained: "Reclassified",
  break: "BREAK",
  missing: "Missing",
};

/**
 * Render a reconciliation as Markdown suitable for pasting into an email,
 * ticket, or Slack message — the output only living in the browser is no
 * use to an analyst who needs to hand the result to someone else.
 */
export function toMarkdownReport(opts: {
  investorLabel: string;
  fundName?: string;
  asOfDate?: string;
  rows: ReconRow[];
  tieOutA: number | null;
  tieOutB: number | null;
}): string {
  const { investorLabel, fundName, asOfDate, rows, tieOutA, tieOutB } = opts;
  const lines: string[] = [];

  lines.push(`# Capital Account Reconciliation — ${investorLabel}`);
  if (fundName) lines.push(`**Fund:** ${fundName}`);
  if (asOfDate) lines.push(`**As of:** ${asOfDate}`);
  lines.push("");

  const needsReview = rows.filter((r) => r.status === "break" || r.status === "missing");
  if (needsReview.length > 0) {
    lines.push(`## ${needsReview.length} item(s) need analyst review`);
    for (const r of needsReview) {
      lines.push(`- **${r.label}:** ${r.explanation}`);
    }
    lines.push("");
  } else {
    lines.push("No items need review — all line items matched, reconciled, or fell within rounding tolerance.");
    lines.push("");
  }

  lines.push("## Line items");
  lines.push("| Line item | Source A | Source B | Variance | Status | Explanation |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.label} | ${r.a !== undefined ? fmtMoney(r.a) : "—"} | ${
        r.b !== undefined ? fmtMoney(r.b) : "—"
      } | ${r.diff !== undefined ? fmtMoney(r.diff) : "—"} | ${STATUS_LABEL[r.status]} | ${r.explanation} |`
    );
  }
  lines.push("");

  if (tieOutA !== null || tieOutB !== null) {
    lines.push("## Internal consistency (beginning + activity = ending)");
    if (tieOutA !== null) {
      lines.push(`- Source A: ${Math.abs(tieOutA) <= 0.01 ? "ties out" : `off by ${fmtMoney(tieOutA)}`}`);
    }
    if (tieOutB !== null) {
      lines.push(`- Source B: ${Math.abs(tieOutB) <= 0.01 ? "ties out" : `off by ${fmtMoney(tieOutB)}`}`);
    }
  }

  return lines.join("\n");
}
