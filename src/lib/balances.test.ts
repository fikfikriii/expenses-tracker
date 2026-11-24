import { describe, expect, it } from "vitest";
import { BalanceBook, isDeposit, isInvestment, type BalanceTx } from "./balances";

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

describe("capital of an investment account", () => {
  const dep = { id: 3, type: "investment", initialBalance: 2_000_000 };
  const bank = { id: 1, type: "bank", initialBalance: 0 };
  const topUp = tx({ type: "transfer", amount: 10_000_000, accountId: 1, toAccountId: 3, occurredOn: "2026-11-22" });

  it("counts the opening balance as capital, so a top-up is not profit", () => {
    const b = new BalanceBook([bank, dep], [], [topUp]);
    expect(b.balanceAt(3, "2026-11-22")).toBe(12_000_000);
    expect(b.capitalIdr(3, "2026-11-22")).toBe(12_000_000);
  });

  it("starts from the last balance check before the first transfer", () => {
    // 2 million at the last check on 12 Nov, then 10 million transferred in on 22 Nov.
    const b = new BalanceBook(
      [bank, { ...dep, initialBalance: 0 }],
      [{ accountId: 3, takenOn: "2026-11-12", balance: 2_000_000 }],
      [topUp],
    );
    const value = b.valueIdr(3, "2026-11-22");
    expect(value).toBe(12_000_000);
    expect(value - b.capitalIdr(3, "2026-11-22")).toBe(0);
  });

  it("still shows real gain: interest after the top-up", () => {
    const b = new BalanceBook(
      [bank, dep],
      [{ accountId: 3, takenOn: "2026-11-30", balance: 12_100_000 }],
      [topUp],
    );
    expect(b.valueIdr(3, "2026-11-30") - b.capitalIdr(3, "2026-11-30")).toBe(100_000);
  });

  it("counts withdrawals back out", () => {
    const out = tx({ type: "transfer", amount: 3_000_000, accountId: 3, toAccountId: 1, occurredOn: "2026-11-25" });
    const b = new BalanceBook([bank, dep], [], [topUp, out]);
    expect(b.capitalIdr(3, "2026-11-30")).toBe(9_000_000);
  });

  it("ignores transfers after the date asked for", () => {
    const b = new BalanceBook([bank, dep], [], [topUp]);
    expect(b.capitalIdr(3, "2026-11-10")).toBe(2_000_000);
  });

  it("without transfers, measures from the opening balance or the first check", () => {
    expect(new BalanceBook([dep], [{ accountId: 3, takenOn: "2026-11-30", balance: 2_100_000 }], []).capitalIdr(3, "2026-11-30")).toBe(2_000_000);
    const noOpening = { ...dep, initialBalance: 0 };
    const snaps = [
      { accountId: 3, takenOn: "2026-10-31", balance: 2_000_000 },
      { accountId: 3, takenOn: "2026-11-30", balance: 2_100_000 },
    ];
    expect(new BalanceBook([noOpening], snaps, []).capitalIdr(3, "2026-11-30")).toBe(2_000_000);
  });
});

describe("deposits", () => {
  const accs = [
    { id: 1, type: "bank", initialBalance: 0 },
    { id: 2, type: "deposit", risk: "low", initialBalance: 0 },
  ];
  const put = tx({ type: "transfer", amount: 10_000_000, accountId: 1, toAccountId: 2 });

  it("counts as investment, not cash", () => {
    expect(isDeposit(accs[1])).toBe(true);
    expect(isInvestment(accs[1])).toBe(true);
    expect(isDeposit({ type: "investment" })).toBe(false);
    const b = new BalanceBook(accs, [], [put]);
    expect(b.totals("2026-11-30")).toEqual({ cash: -10_000_000, investment: 10_000_000, netWorth: 0 });
  });

  it("is left out of unrecorded money and shows in the risk mix", () => {
    const b = new BalanceBook(
      accs,
      [{ accountId: 2, takenOn: "2026-11-30", balance: 10_000_000 }, { accountId: 2, takenOn: "2026-12-31", balance: 10_400_000 }],
      [put],
    );
    expect(b.unrecorded().filter((u) => u.accountId === 2)).toEqual([]);
    expect(b.riskBreakdown("2026-12-31").map((r) => [r.risk, r.value])).toEqual([["low", 10_400_000]]);
  });
});

describe("risk breakdown", () => {
  const accs = [
    { id: 1, type: "bank", initialBalance: 5_000_000 },
    { id: 2, type: "investment", risk: "low", initialBalance: 2_000_000 },
    { id: 3, type: "investment", risk: "high", initialBalance: 1_000_000 },
    { id: 4, type: "investment", risk: null, initialBalance: 1_000_000 },
    { id: 5, type: "investment", risk: "high", initialBalance: 9_000_000, archived: true },
  ];

  it("groups investments by risk and leaves out cash and archived accounts", () => {
    const r = new BalanceBook(accs, [], []).riskBreakdown("2026-11-30");
    expect(r.map((x) => [x.risk, x.value])).toEqual([["low", 2_000_000], ["high", 1_000_000], [null, 1_000_000]]);
    expect(r.map((x) => x.share)).toEqual([0.5, 0.25, 0.25]);
  });

  it("is empty without investments", () => {
    expect(new BalanceBook([accs[0]], [], []).riskBreakdown("2026-11-30")).toEqual([]);
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
