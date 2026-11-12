// Account balances come from the latest month-end check ("snapshot") plus the
// transactions logged after it. Unlogged transfers between accounts therefore
// never make a balance drift for more than one month.

export type BalanceAccount = {
  id: number;
  type: string;
  initialBalance: number;
  archived?: boolean;
};

export type BalanceTx = {
  type: "expense" | "income" | "transfer";
  amount: number;
  occurredOn: string;
  accountId: number;
  toAccountId: number | null;
};

export type Snapshot = { accountId: number; takenOn: string; balance: number };

export const isInvestment = (a: { type: string }) => a.type === "investment";

/** How a transaction changes one account's balance. */
export function effectOn(tx: BalanceTx, accountId: number): number {
  if (tx.type === "income") return tx.accountId === accountId ? tx.amount : 0;
  if (tx.type === "expense") return tx.accountId === accountId ? -tx.amount : 0;
  let e = 0;
  if (tx.accountId === accountId) e -= tx.amount;
  if (tx.toAccountId === accountId) e += tx.amount;
  return e;
}

function sumEffects(txs: BalanceTx[], accountId: number, after: string | null, upTo: string): number {
  let s = 0;
  for (const tx of txs) {
    if (tx.occurredOn > upTo) continue;
    if (after !== null && tx.occurredOn <= after) continue;
    s += effectOn(tx, accountId);
  }
  return s;
}

export class BalanceBook {
  private snapsByAccount = new Map<number, Snapshot[]>();

  constructor(
    readonly accounts: BalanceAccount[],
    snapshots: Snapshot[],
    readonly txs: BalanceTx[],
  ) {
    for (const s of [...snapshots].sort((a, b) => a.takenOn.localeCompare(b.takenOn))) {
      const list = this.snapsByAccount.get(s.accountId) ?? [];
      list.push(s);
      this.snapsByAccount.set(s.accountId, list);
    }
  }

  snapshots(accountId: number): Snapshot[] {
    return this.snapsByAccount.get(accountId) ?? [];
  }

  lastSnapshot(accountId: number, onOrBefore: string): Snapshot | null {
    const list = this.snapshots(accountId);
    for (let i = list.length - 1; i >= 0; i--) if (list[i].takenOn <= onOrBefore) return list[i];
    return null;
  }

  /** Balance at the end of `date`. */
  balanceAt(accountId: number, date: string): number {
    const snap = this.lastSnapshot(accountId, date);
    if (snap) return snap.balance + sumEffects(this.txs, accountId, snap.takenOn, date);
    const acc = this.accounts.find((a) => a.id === accountId);
    return (acc?.initialBalance ?? 0) + sumEffects(this.txs, accountId, null, date);
  }

  /**
   * What the balance should be on `date` from the previous snapshot and logged transactions.
   * Null when there is no earlier snapshot to compare with.
   */
  expectedAt(accountId: number, date: string): number | null {
    const prev = this.snapshots(accountId).filter((s) => s.takenOn < date).at(-1);
    if (!prev) return null;
    return prev.balance + sumEffects(this.txs, accountId, prev.takenOn, date);
  }

  /**
   * Money that moved without being logged, per snapshot: real balance minus expected.
   * Investment accounts are left out because their value moves with the market.
   */
  unrecorded(): { accountId: number; takenOn: string; diff: number }[] {
    const out: { accountId: number; takenOn: string; diff: number }[] = [];
    for (const acc of this.accounts) {
      if (isInvestment(acc)) continue;
      for (const s of this.snapshots(acc.id)) {
        const expected = this.expectedAt(acc.id, s.takenOn);
        if (expected !== null) out.push({ accountId: acc.id, takenOn: s.takenOn, diff: s.balance - expected });
      }
    }
    return out;
  }

  /** Sum of unrecorded money for snapshots taken in [start, end]. */
  unrecordedBetween(start: string, end: string): number {
    return this.unrecorded()
      .filter((u) => u.takenOn >= start && u.takenOn <= end)
      .reduce((s, u) => s + u.diff, 0);
  }

  /** Net money put into an account through logged transfers (an investment's capital). */
  netTransfersIn(accountId: number, upTo: string): number {
    let s = 0;
    for (const tx of this.txs) {
      if (tx.type !== "transfer" || tx.occurredOn > upTo) continue;
      if (tx.toAccountId === accountId) s += tx.amount;
      if (tx.accountId === accountId) s -= tx.amount;
    }
    return s;
  }

  totals(date: string, includeArchived = false) {
    let cash = 0;
    let investment = 0;
    for (const a of this.accounts) {
      if (a.archived && !includeArchived) continue;
      const b = this.balanceAt(a.id, date);
      if (isInvestment(a)) investment += b;
      else cash += b;
    }
    return { cash, investment, netWorth: cash + investment };
  }
}
