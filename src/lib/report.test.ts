import { describe, expect, it, vi } from "vitest";

vi.mock("./ledger", () => ({ listAllCategories: vi.fn(), listBudgets: vi.fn(), summarize: vi.fn() }));

import { compareLine, formatReport } from "./report";

const summary = (expense: number, income: number, cats: [string, number][] = []) => ({
  expense,
  income,
  byCategory: cats.map(([name, total]) => ({ name, icon: "", kind: "expense" as const, total })),
});

describe("compareLine", () => {
  it("reports increases and decreases", () => {
    expect(compareLine(120, 100, "minggu lalu")).toContain("Naik 20%");
    expect(compareLine(80, 100, "minggu lalu")).toContain("Turun 20%");
    expect(compareLine(100, 100, "minggu lalu")).toContain("Sama");
  });
  it("handles an empty previous period", () => {
    expect(compareLine(0, 0, "x")).toBe("");
    expect(compareLine(50, 0, "x")).toContain("nggak ada");
  });
});

describe("formatReport", () => {
  it("lists top 3 categories and flags hot budgets", () => {
    const text = formatReport({
      title: "T",
      summary: summary(1000, 3000, [["Makan", 600], ["Transport", 250], ["Kopi", 100], ["Lain", 50]]),
      previous: summary(500, 0),
      previousLabel: "bulan lalu",
      budgets: [{ name: "Makan", spent: 600, limit: 500 }, { name: "Kopi", spent: 10, limit: 100 }],
    });
    expect(text).toContain("1. Makan");
    expect(text).toContain("3. Kopi");
    expect(text).not.toContain("4. Lain");
    expect(text).toContain("🚨 Makan 120%");
    expect(text).not.toContain("Kopi 10%");
  });
  it("says budgets are fine when none are hot", () => {
    const text = formatReport({
      title: "T", summary: summary(100, 0, [["Makan", 100]]), previous: summary(0, 0), previousLabel: "x",
      budgets: [{ name: "Makan", spent: 100, limit: 1000 }],
    });
    expect(text).toContain("aman");
  });
  it("handles an empty period", () => {
    const text = formatReport({ title: "T", summary: summary(0, 0), previous: summary(0, 0), previousLabel: "x", budgets: [] });
    expect(text).toContain("Belum ada transaksi");
  });
});
