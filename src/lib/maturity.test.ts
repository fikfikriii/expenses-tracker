import { describe, expect, it } from "vitest";
import { formatRate, maturityLabel, parseRate } from "./maturity";

describe("maturityLabel", () => {
  it("counts the days left", () => {
    expect(maturityLabel("2026-12-12", "2026-11-22")).toBe("jatuh tempo 12 Des · 20 hari lagi");
    expect(maturityLabel("2027-01-05", "2026-11-22")).toBe("jatuh tempo 5 Jan 2027 · 44 hari lagi");
  });
  it("says so on the day and after", () => {
    expect(maturityLabel("2026-11-22", "2026-11-22")).toBe("jatuh tempo hari ini");
    expect(maturityLabel("2026-11-20", "2026-11-22")).toBe("sudah jatuh tempo (20 Nov)");
  });
});

describe("interest rate", () => {
  it("reads rates written either way", () => {
    expect(parseRate("6")).toBe(6);
    expect(parseRate("6,5")).toBe(6.5);
    expect(parseRate(" 6.25% ")).toBe(6.25);
    expect(parseRate("0")).toBe(0);
  });
  it("rejects anything else", () => {
    expect(parseRate("")).toBeNull();
    expect(parseRate("abc")).toBeNull();
    expect(parseRate("-1")).toBeNull();
    expect(parseRate("101")).toBeNull();
  });
  it("formats with a decimal comma", () => {
    expect(formatRate(6)).toBe("6% p.a.");
    expect(formatRate(6.25)).toBe("6,25% p.a.");
  });
});
