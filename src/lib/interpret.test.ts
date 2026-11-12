import { describe, expect, it } from "vitest";
import { interpret, type CategoryRef } from "./interpret";
import type { AccountRef } from "./accounts";

delete process.env.AI_API_KEY; // test the keyword fallback

const accounts: AccountRef[] = [
  { id: 1, name: "Cash", aliases: [], isDefault: true },
  { id: 2, name: "BCA", aliases: [], isDefault: false },
  { id: 3, name: "GoPay", aliases: [], isDefault: false },
];
const categories: CategoryRef[] = [
  { id: 1, name: "Makan & Minum", kind: "expense" },
  { id: 2, name: "Transport", kind: "expense" },
  { id: 10, name: "Lainnya", kind: "expense" },
  { id: 11, name: "Gaji", kind: "income" },
  { id: 14, name: "Pemasukan Lain", kind: "income" },
];
const ctx = { today: "2026-11-12", accounts, categories };

describe("interpret (no AI)", () => {
  it("logs an expense", async () => {
    const r = await interpret("15000 makan bubur", ctx);
    expect(r).toMatchObject({
      ok: true,
      draft: { type: "expense", amount: 15000, categoryId: 1, accountId: 1, note: "Makan bubur" },
    });
  });
  it("uses the named account and strips it from the note", async () => {
    const r = await interpret("50rb bensin pake bca", ctx);
    expect(r).toMatchObject({ ok: true, draft: { accountId: 2, categoryId: 2, note: "Bensin" } });
  });
  it("logs income", async () => {
    const r = await interpret("gajian 8jt", ctx);
    expect(r).toMatchObject({ ok: true, draft: { type: "income", categoryId: 11 } });
  });
  it("logs a transfer", async () => {
    const r = await interpret("transfer 1jt bca ke gopay", ctx);
    expect(r).toMatchObject({
      ok: true,
      draft: { type: "transfer", amount: 1000000, accountId: 2, toAccountId: 3 },
    });
  });
  it("rejects text without an amount", async () => {
    expect(await interpret("halo", ctx)).toEqual({ ok: false, reason: "no_amount" });
  });
});

describe("user categories", () => {
  const cats: CategoryRef[] = [
    ...categories,
    { id: 20, name: "Kopi", kind: "expense", keywords: ["latte", "starbucks"] },
    { id: 21, name: "Kopi Susu", kind: "expense" },
  ];
  const c2 = { ...ctx, categories: cats };

  it("uses a category named in the chat", async () => {
    const r = await interpret("11 Nov 2026, 8000 Kopi", c2);
    expect(r).toMatchObject({ ok: true, draft: { categoryId: 20, date: "2026-11-11", note: "Kopi" } });
  });
  it("uses category keywords", async () => {
    const r = await interpret("45rb latte", c2);
    expect(r).toMatchObject({ ok: true, draft: { categoryId: 20 } });
  });
  it("prefers the longest match", async () => {
    const r = await interpret("20rb kopi susu", c2);
    expect(r).toMatchObject({ ok: true, draft: { categoryId: 21 } });
  });
  it("can match an income category", async () => {
    const r = await interpret("8jt gaji", c2);
    expect(r).toMatchObject({ ok: true, draft: { type: "income", categoryId: 11 } });
  });
});
