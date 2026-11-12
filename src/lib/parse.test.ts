import { describe, expect, it } from "vitest";
import { parseMessage } from "./parse";
import { detectTransfer, pickAccount, type AccountRef } from "./accounts";
import { guessCategory, looksLikeIncome } from "./keywords";
import { monthRange } from "./dates";

const TODAY = "2026-11-12";

describe("parseMessage", () => {
  it.each([
    ["15000 makan bubur", 15000, TODAY, "makan bubur"],
    ["makan bubur 15.000", 15000, TODAY, "makan bubur"],
    ["15rb makan bubur", 15000, TODAY, "makan bubur"],
    ["15k kopi", 15000, TODAY, "kopi"],
    ["Rp 25.500 bensin", 25500, TODAY, "bensin"],
    ["1,5jt kost", 1500000, TODAY, "kost"],
    ["gajian 8jt", 8000000, TODAY, "gajian"],
    ["2 bungkus nasi 30000", 30000, TODAY, "2 bungkus nasi"],
    ["beli 2 kopi 18rb", 18000, TODAY, "beli 2 kopi"],
    ["5 November 2026, 15000 makan bubur", 15000, "2026-11-05", "makan bubur"],
    ["tgl 3 nov 20rb parkir", 20000, "2026-11-03", "parkir"],
    ["kemarin 25rb bensin", 25000, "2026-11-11", "bensin"],
    ["kemarin lusa 10rb parkir", 10000, "2026-11-10", "parkir"],
    ["3 hari lalu 40rb gofood", 40000, "2026-11-09", "gofood"],
    ["01/11/2026 100000 listrik", 100000, "2026-11-01", "listrik"],
    ["2026-10-30 50000 pulsa", 50000, "2026-10-30", "pulsa"],
    ["20 des 300rb kado", 300000, "2025-12-20", "kado"],
    ["12 martabak 30rb", 30000, TODAY, "12 martabak"],
  ])("%s", (text, amount, date, rest) => {
    const p = parseMessage(text, TODAY);
    expect(p.amount).toBe(amount);
    expect(p.date).toBe(date);
    expect(p.rest).toBe(rest);
  });

  it("reads + as an income hint", () => {
    const p = parseMessage("+500rb freelance", TODAY);
    expect(p.amount).toBe(500000);
    expect(p.sign).toBe("+");
  });

  it("returns null without an amount", () => {
    expect(parseMessage("makan bubur", TODAY).amount).toBeNull();
  });
});

const ACCOUNTS: AccountRef[] = [
  { id: 1, name: "Cash", aliases: ["tunai"], isDefault: true },
  { id: 2, name: "BCA", aliases: [], isDefault: false },
  { id: 3, name: "GoPay", aliases: [], isDefault: false },
  { id: 4, name: "SeaBank", aliases: ["sea"], isDefault: false },
];

describe("accounts", () => {
  it("uses the named account", () => {
    expect(pickAccount("bensin pake bca", ACCOUNTS).account.id).toBe(2);
  });
  it("falls back to the default account", () => {
    expect(pickAccount("makan bubur", ACCOUNTS).account.id).toBe(1);
  });
  it.each([
    ["transfer bca ke gopay", 2, 3],
    ["tf dari seabank ke bca", 4, 2],
    ["tf ke gopay dari bca", 2, 3],
    ["topup gopay dari bca", 2, 3],
    ["topup gopay", 1, 3],
  ])("%s", (text, from, to) => {
    const t = detectTransfer(text, ACCOUNTS);
    expect(t?.from.id).toBe(from);
    expect(t?.to.id).toBe(to);
  });
  it("is not a transfer without the keyword", () => {
    expect(detectTransfer("makan pake bca", ACCOUNTS)).toBeNull();
  });
});

describe("keywords", () => {
  it.each([
    ["makan bubur", "Makan & Minum"],
    ["bensin", "Transport"],
    ["bayar kost", "Tempat Tinggal"],
    ["token listrik", "Tagihan"],
    ["sesuatu aneh", "Lainnya"],
  ])("%s -> %s", (text, cat) => expect(guessCategory(text, "expense")).toBe(cat));

  it("spots income", () => {
    expect(looksLikeIncome("gajian")).toBe(true);
    expect(looksLikeIncome("makan siang")).toBe(false);
  });
});

describe("monthRange", () => {
  it("handles month ends", () => {
    expect(monthRange("2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange("2026-12-31")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});
