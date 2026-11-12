import { describe, expect, it } from "vitest";
import { BalanceBook, type BalanceTx } from "./balances";

const accounts = [
  { id: 1, type: "bank", initialBalance: 0 },
  { id: 2, type: "bank", initialBalance: 0 },
  { id: 3, type: "investment", initialBalance: 0 },
];
const tx = (t: Partial<BalanceTx>): BalanceTx => ({
  type: "expense", amount: 0, occurredOn: "2026-11-05", accountId: 1, toAccountId: null, ...t,
});

describe("BalanceBook", () => {
  it("uses the latest snapshot plus later transactions", () => {
    const b = new BalanceBook(
      accounts,
      [{ accountId: 1, takenOn: "2026-10-31", balance: 5_000_000 }],
      [
        tx({ amount: 50_000, occurredOn: "2026-10-20" }), // before snapshot: ignored
        tx({ amount: 15_000, occurredOn: "2026-11-02" }),
        tx({ type: "income", amount: 8_000_000, occurredOn: "2026-11-25" }),
      ],
    );
    expect(b.balanceAt(1, "2026-11-10")).toBe(4_985_000);
    expect(b.balanceAt(1, "2026-11-30")).toBe(12_985_000);
  });

  it("falls back to the opening balance without a snapshot", () => {
    const b = new BalanceBook([{ id: 1, type: "bank", initialBalance: 100_000 }], [], [tx({ amount: 30_000 })]);
    expect(b.balanceAt(1, "2026-11-30")).toBe(70_000);
  });

  it("finds unrecorded money and ignores investments", () => {
    const b = new BalanceBook(
      accounts,
      [
        { accountId: 1, takenOn: "2026-10-31", balance: 5_000_000 },
        { accountId: 2, takenOn: "2026-10-31", balance: 1_000_000 },
        { accountId: 3, takenOn: "2026-10-31", balance: 10_000_000 },
        // Unlogged transfer of 2jt from 1 to 2, a forgotten 100rb expense on 1, 20rb interest on 2.
        { accountId: 1, takenOn: "2026-11-30", balance: 2_885_000 },
        { accountId: 2, takenOn: "2026-11-30", balance: 3_020_000 },
        { accountId: 3, takenOn: "2026-11-30", balance: 10_500_000 },
      ],
      [tx({ amount: 15_000, occurredOn: "2026-11-02" })],
    );
    expect(b.unrecordedBetween("2026-11-01", "2026-11-30")).toBe(-80_000);
    expect(b.unrecordedBetween("2026-10-01", "2026-10-31")).toBe(0); // first snapshots are a starting point
    expect(b.totals("2026-11-30")).toEqual({ cash: 5_905_000, investment: 10_500_000, netWorth: 16_405_000 });
  });

  it("counts transfers into an investment as capital", () => {
    const b = new BalanceBook(accounts, [], [
      tx({ type: "transfer", amount: 1_000_000, accountId: 1, toAccountId: 3 }),
      tx({ type: "transfer", amount: 500_000, accountId: 1, toAccountId: 3, occurredOn: "2026-11-20" }),
    ]);
    expect(b.capitalIdr(3, "2026-11-30")).toBe(1_500_000);
    expect(b.balanceAt(1, "2026-11-30")).toBe(-1_500_000);
  });
});

describe("USD accounts", () => {
  const accs = [
    { id: 1, type: "bank", initialBalance: 0, currency: "IDR" as const },
    { id: 9, type: "investment", initialBalance: 0, currency: "USD" as const },
  ];
  const rates = [
    { rateOn: "2026-11-01", usdIdr: 16000, source: "auto" },
    { rateOn: "2026-11-20", usdIdr: 16500, source: "auto" },
  ];
  const book = new BalanceBook(
    accs,
    [{ accountId: 9, takenOn: "2026-11-30", balance: 110_000 }], // $1,100
    [tx({ type: "transfer", amount: 16_300_000, toAmount: 100_000, accountId: 1, toAccountId: 9, occurredOn: "2026-11-05" })],
    rates,
  );
  it("keeps balances in dollars and converts totals", () => {
    expect(book.balanceAt(9, "2026-11-10")).toBe(100_000);
    expect(book.valueIdr(9, "2026-11-10")).toBe(16_000_000);
    expect(book.totals("2026-11-30")).toEqual({ cash: -16_300_000, investment: 18_150_000, netWorth: 1_850_000 });
  });
  it("counts the rupiah paid as capital", () => {
    expect(book.capitalIdr(9, "2026-11-30")).toBe(16_300_000);
  });
});
