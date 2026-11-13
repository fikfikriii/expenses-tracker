import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Draft } from "./interpret";
import { monthRange, todayJakarta } from "./dates";
import { BalanceBook } from "./balances";
import { ensureTodayRate, listRates } from "./fx";

const { accounts, categories, transactions, budgets, telegramUpdates, balanceSnapshots } = schema;

/**
 * Throws unless every account and category id belongs to this user. Writes that take ids from
 * a form or chat button go through this, so nobody can attach data to another user's rows.
 */
async function assertOwns(userId: number, ids: { accountIds?: (number | null)[]; categoryIds?: (number | null)[] }) {
  const acc = [...new Set((ids.accountIds ?? []).filter((x): x is number => x !== null))];
  const cat = [...new Set((ids.categoryIds ?? []).filter((x): x is number => x !== null))];
  const [a, c] = await Promise.all([
    acc.length
      ? db().select({ n: count() }).from(accounts).where(and(eq(accounts.userId, userId), inArray(accounts.id, acc)))
      : [{ n: 0 }],
    cat.length
      ? db().select({ n: count() }).from(categories).where(and(eq(categories.userId, userId), inArray(categories.id, cat)))
      : [{ n: 0 }],
  ]);
  if (Number(a[0].n) !== acc.length || Number(c[0].n) !== cat.length) throw new Error("not_found");
}

/**
 * A transaction's amount in rupiah. USD amounts (cents) use the rate on or before the
 * transaction date, or the earliest known rate.
 */
const amountIdr = sql<number>`(case when (select ${accounts.currency} from ${accounts} where ${accounts.id} = ${transactions.accountId}) = 'USD'
  then round(${transactions.amount} / 100.0 * coalesce(
    (select r.usd_idr from fx_rates r where r.rate_on <= ${transactions.occurredOn} order by r.rate_on desc limit 1),
    (select r.usd_idr from fx_rates r order by r.rate_on asc limit 1), 0))
  else ${transactions.amount} end)`;

export async function listAccounts(userId: number) {
  return db()
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.archived, false)))
    .orderBy(desc(accounts.isDefault), asc(accounts.id));
}

export async function listCategories(userId: number) {
  return db()
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.archived, false)))
    .orderBy(asc(categories.kind), asc(categories.id));
}

/** Returns false if this Telegram update was already handled. */
export async function claimTelegramUpdate(updateId: number): Promise<boolean> {
  const rows = await db()
    .insert(telegramUpdates)
    .values({ updateId })
    .onConflictDoNothing()
    .returning({ updateId: telegramUpdates.updateId });
  return rows.length > 0;
}

export async function saveDraft(userId: number, draft: Draft, rawText: string) {
  await assertOwns(userId, {
    accountIds: [draft.accountId, draft.type === "transfer" ? draft.toAccountId : null],
    categoryIds: [draft.type === "transfer" ? null : draft.categoryId],
  });
  const [row] = await db()
    .insert(transactions)
    .values({
      userId,
      type: draft.type,
      amount: draft.amount,
      occurredOn: draft.date,
      accountId: draft.accountId,
      toAccountId: draft.type === "transfer" ? draft.toAccountId : null,
      toAmount: draft.type === "transfer" ? (draft.toAmount ?? null) : null,
      categoryId: draft.type === "transfer" ? null : draft.categoryId,
      note: draft.note,
      rawText,
      source: "telegram",
    })
    .returning();
  return row;
}

export async function getTransaction(userId: number, id: number) {
  const [row] = await db()
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  return row;
}

export async function setTransactionCategory(userId: number, id: number, categoryId: number) {
  await assertOwns(userId, { categoryIds: [categoryId] });
  const [row] = await db()
    .update(transactions)
    .set({ categoryId })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  return row;
}

export async function deleteTransaction(userId: number, id: number) {
  const [row] = await db()
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  return row;
}

export async function lastTransaction(userId: number) {
  const [row] = await db()
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(1);
  return row;
}

export type Summary = {
  expense: number;
  income: number;
  byCategory: { name: string; icon: string; kind: "expense" | "income"; total: number }[];
};

export async function summarize(userId: number, start: string, end: string): Promise<Summary> {
  const rows = await db()
    .select({
      type: transactions.type,
      name: categories.name,
      icon: categories.icon,
      kind: categories.kind,
      total: sql<string>`sum(${amountIdr})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
        sql`${transactions.type} <> 'transfer'`,
      ),
    )
    .groupBy(transactions.type, categories.name, categories.icon, categories.kind);

  const summary: Summary = { expense: 0, income: 0, byCategory: [] };
  for (const r of rows) {
    const total = Number(r.total);
    if (r.type === "expense") summary.expense += total;
    if (r.type === "income") summary.income += total;
    summary.byCategory.push({
      name: r.name ?? "Tanpa kategori",
      icon: r.icon ?? "",
      kind: (r.kind ?? r.type) as "expense" | "income",
      total,
    });
  }
  summary.byCategory.sort((a, b) => b.total - a.total);
  return summary;
}

/** Spending vs. limit for one category in the month that contains `date`. */
export async function budgetStatus(userId: number, categoryId: number, date: string) {
  const [budget] = await db()
    .select()
    .from(budgets)
    .where(and(eq(budgets.categoryId, categoryId), eq(budgets.userId, userId)));
  if (!budget) return null;
  const { start, end } = monthRange(date);
  const [row] = await db()
    .select({ spent: sql<string>`coalesce(sum(${amountIdr}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.categoryId, categoryId),
        eq(transactions.type, "expense"),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
      ),
    );
  return { limit: budget.monthlyLimit, spent: Number(row?.spent ?? 0) };
}

export type MonthlyRow = { month: string; type: "expense" | "income"; category: string; account: string; total: number };

/** Income/expense totals (IDR) grouped by month, category and account. Transfers are left out. */
export async function monthlyBreakdown(userId: number, start: string, end: string): Promise<MonthlyRow[]> {
  const rows = await db()
    .select({
      month: sql<string>`to_char(${transactions.occurredOn}, 'YYYY-MM')`,
      type: transactions.type,
      category: categories.name,
      account: accounts.name,
      total: sql<string>`sum(${amountIdr})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
        sql`${transactions.type} <> 'transfer'`,
      ),
    )
    .groupBy(sql`to_char(${transactions.occurredOn}, 'YYYY-MM')`, transactions.type, categories.name, accounts.name);
  return rows.map((r) => ({
    month: r.month,
    type: r.type as "expense" | "income",
    category: r.category ?? "Tanpa kategori",
    account: r.account,
    total: Number(r.total),
  }));
}

export async function listBudgets(userId: number) {
  return db().select().from(budgets).where(eq(budgets.userId, userId));
}

/** Sets the monthly limit for a category; a limit of null or 0 removes the budget. */
export async function setBudget(userId: number, categoryId: number, limit: number | null) {
  await assertOwns(userId, { categoryIds: [categoryId] });
  if (!limit || limit <= 0) {
    await db().delete(budgets).where(and(eq(budgets.categoryId, categoryId), eq(budgets.userId, userId)));
    return;
  }
  await db()
    .insert(budgets)
    .values({ userId, categoryId, monthlyLimit: limit })
    .onConflictDoUpdate({ target: budgets.categoryId, set: { monthlyLimit: limit } });
}

// ---------- Dashboard queries ----------

export async function listAllAccounts(userId: number) {
  return db().select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.archived), desc(accounts.isDefault), asc(accounts.id));
}

export async function listAllCategories(userId: number) {
  return db().select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.archived), asc(categories.kind), asc(categories.id));
}

/** Everything needed to compute balances. Fine for a personal ledger (a few thousand rows). */
export async function loadBalanceBook(userId: number) {
  const accs = await db().select().from(accounts).where(eq(accounts.userId, userId));
  if (accs.some((a) => a.currency !== "IDR")) await ensureTodayRate().catch(() => {});
  const [snaps, txs, rates] = await Promise.all([
    db().select().from(balanceSnapshots).where(eq(balanceSnapshots.userId, userId)),
    db()
      .select({
        type: transactions.type,
        amount: transactions.amount,
        occurredOn: transactions.occurredOn,
        accountId: transactions.accountId,
        toAccountId: transactions.toAccountId,
        toAmount: transactions.toAmount,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId)),
    listRates(),
  ]);
  return new BalanceBook(accs, snaps, txs, rates);
}

/** Current balance per account. */
export async function accountBalances(userId: number, date = todayJakarta()) {
  const book = await loadBalanceBook(userId);
  return new Map(book.accounts.map((a) => [a.id, book.balanceAt(a.id, date)]));
}

/** Insert or replace the balance of each account on one day. */
export async function saveSnapshots(userId: number, takenOn: string, items: { accountId: number; balance: number }[]) {
  if (items.length === 0) return;
  await assertOwns(userId, { accountIds: items.map((i) => i.accountId) });
  await db()
    .insert(balanceSnapshots)
    .values(items.map((i) => ({ ...i, userId, takenOn })))
    .onConflictDoUpdate({
      target: [balanceSnapshots.accountId, balanceSnapshots.takenOn],
      set: { balance: sql`excluded.balance`, createdAt: sql`now()` },
    });
}

export async function deleteSnapshot(userId: number, id: number) {
  await db()
    .delete(balanceSnapshots)
    .where(and(eq(balanceSnapshots.id, id), eq(balanceSnapshots.userId, userId)));
}

export async function listSnapshots(userId: number) {
  return db()
    .select()
    .from(balanceSnapshots)
    .where(eq(balanceSnapshots.userId, userId))
    .orderBy(desc(balanceSnapshots.takenOn), asc(balanceSnapshots.accountId));
}

export type TxFilters = {
  from?: string;
  to?: string;
  type?: "expense" | "income" | "transfer";
  categoryId?: number;
  accountId?: number;
  q?: string;
};

function txWhere(userId: number, f: TxFilters) {
  return and(
    eq(transactions.userId, userId),
    f.from ? gte(transactions.occurredOn, f.from) : undefined,
    f.to ? lte(transactions.occurredOn, f.to) : undefined,
    f.type ? eq(transactions.type, f.type) : undefined,
    f.categoryId ? eq(transactions.categoryId, f.categoryId) : undefined,
    f.accountId
      ? sql`(${transactions.accountId} = ${f.accountId} or ${transactions.toAccountId} = ${f.accountId})`
      : undefined,
    f.q ? sql`${transactions.note} ilike ${"%" + f.q + "%"}` : undefined,
  );
}

export async function listTransactions(userId: number, f: TxFilters, limit = 50, offset = 0) {
  const where = txWhere(userId, f);
  const [rows, [count]] = await Promise.all([
    db()
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.occurredOn), desc(transactions.id))
      .limit(limit)
      .offset(offset),
    db().select({ n: sql<string>`count(*)` }).from(transactions).where(where),
  ]);
  return { rows, total: Number(count?.n ?? 0) };
}

export type TxInput = {
  type: "expense" | "income" | "transfer";
  amount: number;
  toAmount: number | null;
  occurredOn: string;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  note: string;
};

export async function createTransaction(userId: number, input: TxInput) {
  await assertOwns(userId, { accountIds: [input.accountId, input.toAccountId], categoryIds: [input.categoryId] });
  const [row] = await db()
    .insert(transactions)
    .values({ ...input, userId, source: "dashboard" })
    .returning();
  return row;
}

export async function updateTransaction(userId: number, id: number, input: TxInput) {
  await assertOwns(userId, { accountIds: [input.accountId, input.toAccountId], categoryIds: [input.categoryId] });
  const [row] = await db()
    .update(transactions)
    .set(input)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  return row;
}

export type AccountInput = {
  name: string;
  type: (typeof schema.accountType.enumValues)[number];
  currency: "IDR" | "USD";
  aliases: string[];
  initialBalance: number;
  isDefault: boolean;
  archived: boolean;
};

async function clearDefaultIf(userId: number, isDefault: boolean, exceptId?: number) {
  if (!isDefault) return;
  await db()
    .update(accounts)
    .set({ isDefault: false })
    .where(and(eq(accounts.userId, userId), exceptId ? sql`${accounts.id} <> ${exceptId}` : undefined));
}

export async function createAccount(userId: number, input: AccountInput) {
  await clearDefaultIf(userId, input.isDefault);
  const [row] = await db().insert(accounts).values({ ...input, userId }).returning();
  return row;
}

export async function updateAccount(userId: number, id: number, input: AccountInput) {
  await clearDefaultIf(userId, input.isDefault, id);
  const [row] = await db()
    .update(accounts)
    .set(input)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();
  return row;
}

export type CategoryInput = {
  name: string;
  kind: "expense" | "income";
  icon: string;
  keywords: string[];
  archived: boolean;
};

export async function createCategory(userId: number, input: CategoryInput) {
  const [row] = await db().insert(categories).values({ ...input, userId }).returning();
  return row;
}

export async function updateCategory(userId: number, id: number, input: Omit<CategoryInput, "kind">) {
  const [row] = await db()
    .update(categories)
    .set(input)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();
  return row;
}

/** Recent transactions for the overview. */
export async function recentTransactions(userId: number, limit = 8) {
  return db()
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.occurredOn), desc(transactions.id))
    .limit(limit);
}
