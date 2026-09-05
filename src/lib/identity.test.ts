import { describe, expect, it } from "vitest";
import { checkIdentity } from "./identity";
import { parseStatement } from "./parse";
import { SAMPLE_A, SAMPLE_B } from "./samples";

describe("checkIdentity", () => {
  it("does not flag the same date written in two different formats", () => {
    const a = parseStatement("Investor: X\nAs of: June 30, 2026\nBeginning Capital Account Balance: $1.00");
    const b = parseStatement("Investor: X\nStatement Date: 06/30/2026\nOpening Balance: $1.00");
    expect(checkIdentity(a, b)).toEqual([]);
  });

  it("flags genuinely different dates", () => {
    const a = parseStatement("As of: June 30, 2026\nBeginning Capital Account Balance: $1.00");
    const b = parseStatement("Statement Date: 03/31/2026\nOpening Balance: $1.00");
    const mismatches = checkIdentity(a, b);
    expect(mismatches.some((m) => m.field === "Period / as-of date")).toBe(true);
  });

  it("flags a different investor name", () => {
    const a = parseStatement("Investor: Alpha LP\nBeginning Capital Account Balance: $1.00");
    const b = parseStatement("Investor: Beta LP\nOpening Balance: $1.00");
    const mismatches = checkIdentity(a, b);
    expect(mismatches.some((m) => m.field === "Investor")).toBe(true);
  });

  it("reports no mismatches for the sample pair", () => {
    const a = parseStatement(SAMPLE_A);
    const b = parseStatement(SAMPLE_B);
    expect(checkIdentity(a, b)).toEqual([]);
  });
});
