import { describe, expect, it } from "vitest";
import { parseStatement } from "./parse";
import { reconcile } from "./reconcile";
import { SAMPLE_A, SAMPLE_B } from "./samples";
import { toMarkdownReport } from "./report";

describe("toMarkdownReport", () => {
  it("includes the break items and both tie-out results", () => {
    const a = parseStatement(SAMPLE_A);
    const b = parseStatement(SAMPLE_B);
    const { rows, summary } = reconcile(a, b);
    const md = toMarkdownReport({
      investorLabel: "Meridian Pension Trust",
      fundName: a.fundName,
      asOfDate: a.asOfDate,
      rows,
      tieOutA: summary.tieOutA,
      tieOutB: summary.tieOutB,
    });

    expect(md).toContain("Meridian Pension Trust");
    expect(md).toContain("need analyst review");
    expect(md).toContain("Unrealized gain / (loss)");
    expect(md).toContain("ties out");
  });
});
