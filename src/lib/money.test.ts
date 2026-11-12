import { describe, expect, it } from "vitest";
import { convert, extractUsd, formatMoney, parseDecimal, parseFormAmount } from "./money";
import { extractAmount } from "./parse";

describe("money", () => {
  it.each([
    ["1,250.50", 1250.5], ["1.250,50", 1250.5], ["1250.5", 1250.5], ["12,5", 12.5],
    ["1.250", 1250], ["1,000,000", 1000000], ["1000", 1000],
  ])("parseDecimal %s", (s, n) => expect(parseDecimal(s)).toBe(n));

  it.each([
    ["tf 16,3jt bca ke ibkr $1000", 100000, "tf 16,3jt bca ke ibkr"],
    ["saham $1,250.50", 125050, "saham"],
    ["usd 20 netflix", 2000, "netflix"],
    ["50 dollar", 5000, ""],
    ["$1,5k", 150000, ""],
    ["15000 makan", null, "15000 makan"],
  ])("extractUsd %s", (s, cents, rest) => {
    const r = extractUsd(s);
    expect(r.cents).toBe(cents);
    expect(r.text.replace(/\s+/g, " ").trim()).toBe(rest);
  });

  it("formats and converts", () => {
    expect(formatMoney(125050, "USD")).toBe("$1,250.50");
    expect(formatMoney(15000, "IDR")).toBe("Rp15.000");
    expect(convert(100000, "USD", "IDR", 16300)).toBe(16_300_000);
    expect(convert(16_300_000, "IDR", "USD", 16300)).toBe(100000);
  });

  it("parses form amounts", () => {
    const idr = (s: string) => extractAmount(s).amount;
    expect(parseFormAmount("1,5jt", "IDR", idr)).toBe(1500000);
    expect(parseFormAmount("1250.50", "USD", idr)).toBe(125050);
    expect(parseFormAmount("$1,000", "USD", idr)).toBe(100000);
    expect(parseFormAmount("-50", "USD", idr)).toBe(-5000);
  });
});
