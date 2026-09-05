import { describe, expect, it } from "vitest";
import { parseMultiStatement } from "./parse";
import { pairInvestors } from "./pairing";

describe("pairInvestors", () => {
  it("pairs single-investor documents positionally even without a matching name", () => {
    const a = parseMultiStatement("Beginning Capital Account Balance: $1,000.00");
    const b = parseMultiStatement("Opening Balance: $1,000.00");
    const pairs = pairInvestors(a, b);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a).toBeDefined();
    expect(pairs[0].b).toBeDefined();
  });

  it("matches investors by name across two multi-investor documents", () => {
    const a = parseMultiStatement(
      [
        "Investor: Alpha LP",
        "Beginning Capital Account Balance: $1,000,000.00",
        "",
        "Investor: Beta LP",
        "Beginning Capital Account Balance: $2,000,000.00",
      ].join("\n")
    );
    const b = parseMultiStatement(
      [
        "Investor: Beta LP",
        "Opening Balance: $2,000,000.00",
        "",
        "Investor: Alpha LP",
        "Opening Balance: $1,000,000.00",
      ].join("\n")
    );

    const pairs = pairInvestors(a, b);
    expect(pairs).toHaveLength(2);
    const alpha = pairs.find((p) => p.label === "Alpha LP")!;
    expect(alpha.a?.fields.beginningCapital).toBe(1000000);
    expect(alpha.b?.fields.beginningCapital).toBe(1000000);
  });

  it("surfaces an investor present on only one side instead of dropping them", () => {
    const a = parseMultiStatement(
      [
        "Investor: Alpha LP",
        "Beginning Capital Account Balance: $1,000,000.00",
        "",
        "Investor: Beta LP",
        "Beginning Capital Account Balance: $2,000,000.00",
      ].join("\n")
    );
    const b = parseMultiStatement("Investor: Alpha LP\nOpening Balance: $1,000,000.00");

    const pairs = pairInvestors(a, b);
    expect(pairs).toHaveLength(2);
    const beta = pairs.find((p) => p.label === "Beta LP")!;
    expect(beta.a).toBeDefined();
    expect(beta.b).toBeUndefined();
  });
});
