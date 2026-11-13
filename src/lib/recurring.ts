import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthRange } from "./dates";

const { recurring, transactions, accounts, categories } = schema;

export type Recurring = typeof recurring.$inferSelect;

/** The date a rule fires in `month` ("YYYY-MM"): its day, or the month's last day when shorter. */
export function dueDateIn(month: string, dayOfMonth: number): string {
  const last = Number(monthRange(`${month}-01`).end.slice(8, 10));
  return `${month}-${String(Math.min(dayOfMonth, last)).padStart(2, "0")}`;
}

/** A rule is due once today reaches its date this month and it has not run this month yet. */
export function isDue(r: Pick<Recurring, "active" | "dayOfMonth" | "lastRunMonth">, today: string): boolean {
  const month = today.slice(0, 7);
  return r.active && r.lastRunMonth !== month && today >= dueDateIn(month, r.dayOfMonth);
}

export type RecurringInput = {
  type: "expense" | "income";
  amount: number;
  accountId: number;
  categoryId: number | null;
  note: string;
  dayOfMonth: number;
  active: boolean;
};

export async function listRecurring(userId: number) {
  return db().select().from(recurring).where(eq(recurring.userId, userId)).orderBy(asc(recurring.dayOfMonth), asc(recurring.id));
}

async function assertOwnsRule(userId: number, input: RecurringInput) {
  const [a] = await db()
    .select({ n: count() })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), inArray(accounts.id, [input.accountId])));
  const [c] = input.categoryId
    ? await db()
        .select({ n: count() })
        .from(categories)
        .where(and(eq(categories.userId, userId), inArray(categories.id, [input.categoryId])))
    : [{ n: 1 }];
  if (Number(a.n) !== 1 || Number(c.n) !== 1) throw new Error("not_found");
}

export async function createRecurring(userId: number, input: RecurringInput, today: string) {
  await assertOwnsRule(userId, input);
  const month = today.slice(0, 7);
  // A rule added after its day has passed starts next month instead of back-filling.
  const passed = today > dueDateIn(month, input.dayOfMonth);
  await db()
    .insert(recurring)
    .values({ ...input, userId, lastRunMonth: passed ? month : null });
}

export async function updateRecurring(userId: number, id: number, input: RecurringInput) {
  await assertOwnsRule(userId, input);
  await db()
    .update(recurring)
    .set(input)
    .where(and(eq(recurring.id, id), eq(recurring.userId, userId)));
}

export async function deleteRecurring(userId: number, id: number) {
  await db().delete(recurring).where(and(eq(recurring.id, id), eq(recurring.userId, userId)));
}

/** Creates this month's transactions for every due rule of one user. Returns what was created. */
export async function runRecurring(userId: number, today: string) {
  const month = today.slice(0, 7);
  const created: { rule: Recurring; occurredOn: string }[] = [];
  for (const rule of await listRecurring(userId)) {
    if (!isDue(rule, today)) continue;
    // Claim the month first so two overlapping runs can't both create it.
    const claimed = await db()
      .update(recurring)
      .set({ lastRunMonth: month })
      .where(and(eq(recurring.id, rule.id), sql`${recurring.lastRunMonth} is distinct from ${month}`))
      .returning({ id: recurring.id });
    if (claimed.length === 0) continue;
    const occurredOn = dueDateIn(month, rule.dayOfMonth);
    try {
      await db().insert(transactions).values({
        userId,
        type: rule.type,
        amount: rule.amount,
        occurredOn,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        note: rule.note,
        rawText: `rutin: ${rule.note}`,
        source: "recurring",
      });
      created.push({ rule, occurredOn });
    } catch (e) {
      // Release the claim so the next run retries.
      await db().update(recurring).set({ lastRunMonth: null }).where(eq(recurring.id, rule.id));
      console.error("recurring failed", rule.id, e);
    }
  }
  return created;
}

