import { describe, expect, it } from "vitest";
import { parseStatement } from "./parse";
import { reconcile } from "./reconcile";
import { SAMPLE_A, SAMPLE_B } from "./samples";

describe("reconcile", () => {
  it("flags exactly the unrealized gain and its cascade into ending capital on the sample pair", () => {
    const { rows, summary } = reconcile(parseStatement(SAMPLE_A), parseStatement(SAMPLE_B));
    const breaks = rows.filter((r) => r.status === "break").map((r) => r.key);
    expect(breaks).toEqual(["unrealizedGain", "endingCapital"]);
    expect(summary.matches).toBe(9);
    expect(summary.missing).toBe(0);
  });

  it("both sample statements tie out internally", () => {
    const { summary } = reconcile(parseStatement(SAMPLE_A), parseStatement(SAMPLE_B));
    expect(summary.tieOutA).toBeCloseTo(0, 2);
    expect(summary.tieOutB).toBeCloseTo(0, 2);
  });

  it("marks identical values as a match", () => {
    const a = parseStatement("Beginning Capital Account Balance: $1,000.00");
    const b = parseStatement("Opening Balance: $1,000.00");
    const { rows } = reconcile(a, b);
    expect(rows[0].status).toBe("match");
  });

  it("treats a sub-cent difference as a match, not rounding noise", () => {
    const a = parseStatement("Beginning Capital Account Balance: $1,000.00");
    const b = parseStatement("Opening Balance: $1,000.005");
    const { rows } = reconcile(a, b);
    expect(rows[0].status).toBe("match");
  });

  it("classifies a small relative variance as rounding", () => {
    const a = parseStatement("Beginning Capital Account Balance: $1,000,000.00");
    const b = parseStatement("Opening Balance: $1,000,050.00"); // 0.005% off
    const { rows } = reconcile(a, b);
    expect(rows[0].status).toBe("rounding");
  });

  it("classifies a large relative variance as a break", () => {
    const a = parseStatement("Beginning Capital Account Balance: $1,000,000.00");
    const b = parseStatement("Opening Balance: $900,000.00");
    const { rows } = reconcile(a, b);
    expect(rows[0].status).toBe("break");
  });

  it("marks a field present in only one source as missing", () => {
    const a = parseStatement("Beginning Capital Account Balance: $1,000.00");
    const b = parseStatement("Something Unrelated: 5");
    const { rows, summary } = reconcile(a, b);
    expect(rows[0].status).toBe("missing");
    expect(summary.missing).toBe(1);
  });

  it("explains a variance that exactly matches another line item as a reclassification", () => {
    const a = parseStatement(
      "Beginning Capital Account Balance: $1,000,000.00\nManagement Fees: ($10,000.00)"
    );
    const b = parseStatement(
      "Opening Balance: $990,000.00\nAdvisory Fee: ($10,000.00)"
    );
    const { rows } = reconcile(a, b);
    const beginningRow = rows.find((r) => r.key === "beginningCapital")!;
    expect(beginningRow.status).toBe("explained");
  });

  it("returns null tie-out when there isn't enough data to compute a roll-forward", () => {
    const a = parseStatement("Beginning Capital Account Balance: $1,000.00");
    const b = parseStatement("Opening Balance: $1,000.00");
    const { summary } = reconcile(a, b);
    expect(summary.tieOutA).toBeNull();
    expect(summary.tieOutB).toBeNull();
  });
});
