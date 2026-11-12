import { describe, expect, it } from "vitest";
import { isSaldoMessage, parseSaldo } from "./saldo";
import type { AccountRef } from "./accounts";

const accounts: AccountRef[] = [
  { id: 1, name: "BCA", aliases: [], isDefault: true },
  { id: 2, name: "Mandiri", aliases: ["livin"], isDefault: false },
  { id: 3, name: "SeaBank", aliases: ["sea"], isDefault: false },
  { id: 4, name: "Reksadana", aliases: ["rd", "bibit"], isDefault: false },
  { id: 5, name: "IBKR", aliases: [], isDefault: false, currency: "USD" },
];
const TODAY = "2026-11-30";
const pick = (r: ReturnType<typeof parseSaldo>) => r?.items.map((i) => [i.account.id, i.balance]);

describe("parseSaldo", () => {
  it("reads several accounts", () => {
    const r = parseSaldo("saldo bca 5,2jt mandiri 3,1jt seabank 800rb", accounts, TODAY);
    expect(pick(r)).toEqual([[1, 5_200_000], [2, 3_100_000], [3, 800_000]]);
    expect(r?.date).toBe(TODAY);
  });
  it("reads colons, commas and a date", () => {
    const r = parseSaldo("/saldo 31 okt bca: 5.200.000, livin 3.000.000, rd 10jt", accounts, TODAY);
    expect(pick(r)).toEqual([[1, 5_200_000], [2, 3_000_000], [4, 10_000_000]]);
    expect(r?.date).toBe("2026-10-31");
  });
  it("reports accounts without an amount", () => {
    const r = parseSaldo("saldo bca mandiri 2jt", accounts, TODAY);
    expect(pick(r)).toEqual([[2, 2_000_000]]);
    expect(r?.missing.map((a) => a.id)).toEqual([1]);
  });
  it("reads dollars for USD accounts", () => {
    expect(pick(parseSaldo("saldo ibkr $1,250.50 bca 5jt", accounts, TODAY))).toEqual([[5, 125050], [1, 5_000_000]]);
    expect(pick(parseSaldo("saldo ibkr 1.250,50", accounts, TODAY))).toEqual([[5, 125050]]);
  });
  it("returns null without accounts", () => {
    expect(parseSaldo("/saldo", accounts, TODAY)).toBeNull();
  });
  it("detects saldo messages", () => {
    expect(isSaldoMessage("Saldo bca 5jt")).toBe(true);
    expect(isSaldoMessage("/saldo@my_bot")).toBe(true);
    expect(isSaldoMessage("15000 makan")).toBe(false);
    expect(isSaldoMessage("saldoku")).toBe(false);
  });
});
