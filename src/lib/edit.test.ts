import { describe, expect, it } from "vitest";
import { parseEditAmount, parseEditDate, parseEditNote } from "./edit";

describe("parseEditAmount", () => {
  it("reads rupiah", () => {
    expect(parseEditAmount("25rb", "IDR")).toBe(25000);
    expect(parseEditAmount("15.000", "IDR")).toBe(15000);
    expect(parseEditAmount("1,5jt", "IDR")).toBe(1500000);
  });
  it("reads dollars as cents", () => {
    expect(parseEditAmount("$12.50", "USD")).toBe(1250);
    expect(parseEditAmount("12,5", "USD")).toBe(1250);
    expect(parseEditAmount("100", "USD")).toBe(10000);
  });
  it("rejects text without an amount", () => {
    expect(parseEditAmount("banyak", "IDR")).toBeNull();
    expect(parseEditAmount("0", "USD")).toBeNull();
  });
});

describe("parseEditDate", () => {
  it("needs a real date", () => {
    expect(parseEditDate("kemarin", "2026-11-21")).toBe("2026-11-20");
    expect(parseEditDate("5 Nov", "2026-11-21")).toBe("2026-11-05");
    expect(parseEditDate("terserah", "2026-11-21")).toBeNull();
  });
});

describe("parseEditNote", () => {
  it("trims and limits length", () => {
    expect(parseEditNote("  makan   bubur ")).toBe("makan bubur");
    expect(parseEditNote("   ")).toBeNull();
    expect(parseEditNote("x".repeat(201))).toBeNull();
  });
});
