import { afterEach, describe, expect, it, vi } from "vitest";
import { parseStatement } from "./parse";
import { convertStatement, fetchFxRate } from "./fx";

describe("currency detection", () => {
  it("detects USD from $ symbols", () => {
    expect(parseStatement("Beginning Capital Account Balance: $1,000.00").currency).toBe("USD");
  });

  it("detects EUR from € symbols", () => {
    expect(parseStatement("Beginning Capital Account Balance: €1.000,00").currency).toBe("EUR");
  });

  it("detects GBP from £ symbols", () => {
    expect(parseStatement("Beginning Capital Account Balance: £1,000.00").currency).toBe("GBP");
  });

  it("prefers an explicit Currency: line over symbol counting", () => {
    const result = parseStatement("Currency: EUR\nBeginning Capital Account Balance: $1,000.00");
    expect(result.currency).toBe("EUR");
  });

  it("returns undefined when no currency signal is present", () => {
    expect(parseStatement("Beginning Capital Account Balance: 1000").currency).toBeUndefined();
  });
});

describe("convertStatement", () => {
  it("multiplies every numeric field by the given rate", () => {
    const stmt = parseStatement(
      "Beginning Capital Account Balance: €1,000.00\nEnding Capital Account Balance: €1,100.00"
    );
    const converted = convertStatement(stmt, 1.1);
    expect(converted.fields.beginningCapital).toBeCloseTo(1100, 5);
    expect(converted.fields.endingCapital).toBeCloseTo(1210, 5);
  });

  it("leaves an empty statement's fields empty", () => {
    const stmt = parseStatement("Nothing here");
    const converted = convertStatement(stmt, 1.1);
    expect(Object.keys(converted.fields)).toHaveLength(0);
  });
});

describe("fetchFxRate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns rate 1 without a network call when currencies match", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await fetchFxRate("USD", "USD");
    expect(result.rate).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses a successful frankfurter.dev response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ amount: 1, base: "EUR", date: "2026-09-04", rates: { USD: 1.16 } }),
      })
    );
    const result = await fetchFxRate("EUR", "USD");
    expect(result.rate).toBe(1.16);
    expect(result.date).toBe("2026-09-04");
  });

  it("throws a readable error when the request fails", async () => {
    // A currency pair not used by an earlier test, so the in-module cache
    // can't short-circuit this and skip calling the (failing) mock.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchFxRate("GBP", "JPY")).rejects.toThrow(/503/);
  });
});
