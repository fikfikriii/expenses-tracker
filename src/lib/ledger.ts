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
