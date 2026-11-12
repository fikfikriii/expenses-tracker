import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Draft } from "./interpret";
import { monthRange } from "./dates";

const { accounts, categories, transactions, budgets, telegramUpdates } = schema;

export async function listAccounts() {
  return db()
    .select()
    .from(accounts)
    .where(eq(accounts.archived, false))
    .orderBy(desc(accounts.isDefault), asc(accounts.id));
}

export async function listCategories() {
  return db()
    .select()
    .from(categories)
    .where(eq(categories.archived, false))
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

export async function saveDraft(draft: Draft, rawText: string) {
  const [row] = await db()
    .insert(transactions)
    .values({
      type: draft.type,
      amount: draft.amount,
      occurredOn: draft.date,
      accountId: draft.accountId,
      toAccountId: draft.type === "transfer" ? draft.toAccountId : null,
      categoryId: draft.type === "transfer" ? null : draft.categoryId,
      note: draft.note,
      rawText,
      source: "telegram",
    })
    .returning();
  return row;
}

export async function getTransaction(id: number) {
  const [row] = await db().select().from(transactions).where(eq(transactions.id, id));
  return row;
}

export async function setTransactionCategory(id: number, categoryId: number) {
  const [row] = await db()
    .update(transactions)
    .set({ categoryId })
    .where(eq(transactions.id, id))
    .returning();
  return row;
}

export async function deleteTransaction(id: number) {
  const [row] = await db().delete(transactions).where(eq(transactions.id, id)).returning();
  return row;
}

export async function lastTransaction() {
  const [row] = await db()
    .select()
    .from(transactions)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(1);
  return row;
}

export type Summary = {
  expense: number;
  income: number;
  byCategory: { name: string; icon: string; kind: "expense" | "income"; total: number }[];
};

export async function summarize(start: string, end: string): Promise<Summary> {
  const rows = await db()
    .select({
      type: transactions.type,
      name: categories.name,
      icon: categories.icon,
      kind: categories.kind,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
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
export async function budgetStatus(categoryId: number, date: string) {
  const [budget] = await db().select().from(budgets).where(eq(budgets.categoryId, categoryId));
  if (!budget) return null;
  const { start, end } = monthRange(date);
  const [row] = await db()
    .select({ spent: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.categoryId, categoryId),
        eq(transactions.type, "expense"),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
      ),
    );
  return { limit: budget.monthlyLimit, spent: Number(row?.spent ?? 0) };
}

// ---------- Dashboard queries ----------

export async function listAllAccounts() {
  return db().select().from(accounts).orderBy(asc(accounts.archived), desc(accounts.isDefault), asc(accounts.id));
}

export async function listAllCategories() {
  return db().select().from(categories).orderBy(asc(categories.archived), asc(categories.kind), asc(categories.id));
}

/** Current balance per account: opening balance plus every transaction up to today. */
export async function accountBalances() {
  const rows = await db()
    .select({
      id: accounts.id,
      initial: accounts.initialBalance,
      delta: sql<string>`coalesce(sum(case
        when ${transactions.type} = 'income' and ${transactions.accountId} = ${accounts.id} then ${transactions.amount}
        when ${transactions.type} in ('expense', 'transfer') and ${transactions.accountId} = ${accounts.id} then -${transactions.amount}
        when ${transactions.type} = 'transfer' and ${transactions.toAccountId} = ${accounts.id} then ${transactions.amount}
        else 0 end), 0)`,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      sql`${transactions.accountId} = ${accounts.id} or ${transactions.toAccountId} = ${accounts.id}`,
    )
    .groupBy(accounts.id);
  return new Map(rows.map((r) => [r.id, r.initial + Number(r.delta)]));
}

export type TxFilters = {
  from?: string;
  to?: string;
  type?: "expense" | "income" | "transfer";
  categoryId?: number;
  accountId?: number;
  q?: string;
};

function txWhere(f: TxFilters) {
  return and(
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

export async function listTransactions(f: TxFilters, limit = 50, offset = 0) {
  const where = txWhere(f);
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
  occurredOn: string;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  note: string;
};

export async function createTransaction(input: TxInput) {
  const [row] = await db()
    .insert(transactions)
    .values({ ...input, source: "dashboard" })
    .returning();
  return row;
}

export async function updateTransaction(id: number, input: TxInput) {
  const [row] = await db().update(transactions).set(input).where(eq(transactions.id, id)).returning();
  return row;
}

export type AccountInput = {
  name: string;
  type: (typeof schema.accountType.enumValues)[number];
  aliases: string[];
  initialBalance: number;
  isDefault: boolean;
  archived: boolean;
};

async function clearDefaultIf(isDefault: boolean, exceptId?: number) {
  if (!isDefault) return;
  await db()
    .update(accounts)
    .set({ isDefault: false })
    .where(exceptId ? sql`${accounts.id} <> ${exceptId}` : undefined);
}

export async function createAccount(input: AccountInput) {
  await clearDefaultIf(input.isDefault);
  const [row] = await db().insert(accounts).values(input).returning();
  return row;
}

export async function updateAccount(id: number, input: AccountInput) {
  await clearDefaultIf(input.isDefault, id);
  const [row] = await db().update(accounts).set(input).where(eq(accounts.id, id)).returning();
  return row;
}

export type CategoryInput = {
  name: string;
  kind: "expense" | "income";
  icon: string;
  keywords: string[];
  archived: boolean;
};

export async function createCategory(input: CategoryInput) {
  const [row] = await db().insert(categories).values(input).returning();
  return row;
}

export async function updateCategory(id: number, input: Omit<CategoryInput, "kind">) {
  const [row] = await db().update(categories).set(input).where(eq(categories.id, id)).returning();
  return row;
}

/** Recent transactions for the overview. */
export async function recentTransactions(limit = 8) {
  return db()
    .select()
    .from(transactions)
    .orderBy(desc(transactions.occurredOn), desc(transactions.id))
    .limit(limit);
}
