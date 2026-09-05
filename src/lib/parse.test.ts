import { describe, expect, it } from "vitest";
import { parseMultiStatement, parseStatement } from "./parse";
import { SAMPLE_A, SAMPLE_B } from "./samples";

describe("parseStatement", () => {
  it("extracts all fields from the sample fund admin statement", () => {
    const result = parseStatement(SAMPLE_A);
    expect(result.fields.beginningCapital).toBe(4812340);
    expect(result.fields.contributions).toBe(650000);
    expect(result.fields.distributions).toBe(-210000);
    expect(result.fields.managementFees).toBe(-48750);
    expect(result.fields.endingCapital).toBe(5469590);
    expect(result.investorName).toBe("Meridian Pension Trust");
  });

  it("extracts all fields from a differently-labelled statement", () => {
    const result = parseStatement(SAMPLE_B);
    expect(result.fields.beginningCapital).toBe(4812340);
    expect(result.fields.unrealizedGain).toBe(178350);
    expect(result.fields.carriedInterest).toBe(-38900);
  });

  it('does not let "unrealized" collide with the "realized" alias', () => {
    const result = parseStatement("Unrealized Gain/(Loss): $100,000.00\nRealized Gain/(Loss): $50,000.00");
    expect(result.fields.unrealizedGain).toBe(100000);
    expect(result.fields.realizedGain).toBe(50000);
  });

  it("parses parenthesized negatives", () => {
    const result = parseStatement("Distributions: ($75,500.25)");
    expect(result.fields.distributions).toBe(-75500.25);
  });

  it("parses minus-sign negatives", () => {
    const result = parseStatement("Return of Capital: -75,500.25");
    expect(result.fields.distributions).toBe(-75500.25);
  });

  it("keeps the first match when a line could match multiple aliases", () => {
    // "Net Realized Gain/(Loss)" should hit realizedGain via its most specific
    // alias, not fall through to a shorter generic one.
    const result = parseStatement("Net Realized Gain/(Loss): $92,400.00");
    expect(result.fields.realizedGain).toBe(92400);
  });

  it("captures investor name, fund name, and as-of date", () => {
    const result = parseStatement(
      "Investor: Jane's LP\nFund: Test Fund II, L.P.\nAs of: March 31, 2026"
    );
    expect(result.investorName).toBe("Jane's LP");
    expect(result.fundName).toBe("Test Fund II, L.P.");
    expect(result.asOfDate).toContain("March 31, 2026");
  });

  it("puts unrecognized lines into unmatchedLines, not silently drops them", () => {
    const result = parseStatement("Some Weird Line Nobody Expected: 42");
    expect(result.unmatchedLines).toContain("Some Weird Line Nobody Expected: 42");
  });

  it("returns an empty fields object for text with no known labels", () => {
    const result = parseStatement("Hello\nWorld");
    expect(Object.keys(result.fields)).toHaveLength(0);
  });

  it("reports the character offset of a matched line within the source text", () => {
    const text = "Fund: Test Fund\nBeginning Capital Account Balance: $1,000.00";
    const result = parseStatement(text);
    const raw = result.raw.beginningCapital!;
    expect(text.slice(raw.start, raw.end)).toBe(raw.line);
    expect(raw.line).toBe("Beginning Capital Account Balance: $1,000.00");
  });
});

describe("parseMultiStatement", () => {
  it("falls back to a single statement when there's 0 or 1 investor line", () => {
    const result = parseMultiStatement(SAMPLE_A);
    expect(result).toHaveLength(1);
    expect(result[0].investorName).toBe("Meridian Pension Trust");
  });

  it("splits a schedule of investors into one statement per investor", () => {
    const text = [
      "Fund: Shared Fund II, L.P.",
      "As of: June 30, 2026",
      "",
      "Investor: Alpha LP",
      "Beginning Capital Account Balance: $1,000,000.00",
      "Ending Capital Account Balance: $1,100,000.00",
      "",
      "Investor: Beta LP",
      "Beginning Capital Account Balance: $2,000,000.00",
      "Ending Capital Account Balance: $2,050,000.00",
    ].join("\n");

    const result = parseMultiStatement(text);
    expect(result).toHaveLength(2);
    expect(result[0].investorName).toBe("Alpha LP");
    expect(result[0].fields.beginningCapital).toBe(1000000);
    expect(result[1].investorName).toBe("Beta LP");
    expect(result[1].fields.beginningCapital).toBe(2000000);
    // Preamble (fund name, date) should carry into every block.
    expect(result[0].fundName).toBe("Shared Fund II, L.P.");
    expect(result[1].fundName).toBe("Shared Fund II, L.P.");
  });

  it("keeps offsets valid against the original multi-investor text", () => {
    const text = [
      "Investor: Alpha LP",
      "Beginning Capital Account Balance: $1,000,000.00",
      "",
      "Investor: Beta LP",
      "Beginning Capital Account Balance: $2,000,000.00",
    ].join("\n");

    const result = parseMultiStatement(text);
    const betaRaw = result[1].fields.beginningCapital;
    expect(betaRaw).toBe(2000000);
    const raw = result[1].raw.beginningCapital!;
    expect(text.slice(raw.start, raw.end)).toBe(raw.line);
  });
});
