import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthRange } from "./dates";

const { recurring, transactions } = schema;

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

export async function listRecurring() {
  return db().select().from(recurring).orderBy(asc(recurring.dayOfMonth), asc(recurring.id));
}

export async function createRecurring(input: RecurringInput, today: string) {
  const month = today.slice(0, 7);
  // A rule added after its day has passed starts next month instead of back-filling.
  const passed = today > dueDateIn(month, input.dayOfMonth);
  await db()
    .insert(recurring)
    .values({ ...input, lastRunMonth: passed ? month : null });
}

export async function updateRecurring(id: number, input: RecurringInput) {
  await db().update(recurring).set(input).where(eq(recurring.id, id));
}

export async function deleteRecurring(id: number) {
  await db().delete(recurring).where(eq(recurring.id, id));
}

/** Creates this month's transactions for every due rule. Returns what was created. */
export async function runRecurring(today: string) {
  const month = today.slice(0, 7);
  const created: { rule: Recurring; occurredOn: string }[] = [];
  for (const rule of await listRecurring()) {
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

