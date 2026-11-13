import {
  bigint,
  boolean,
  date,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

// Amounts are bigint in the account currency's smallest unit (see `currency`).

export const accountType = pgEnum("account_type", [
  "cash",
  "bank",
  "ewallet",
  "savings",
  "credit_card",
  "investment",
  "other",
]);

// Amounts are stored in the account currency's smallest unit:
// whole rupiah for IDR, cents for USD.
export const currency = pgEnum("currency", ["IDR", "USD"]);

export const categoryKind = pgEnum("category_kind", ["expense", "income"]);

export const transactionType = pgEnum("transaction_type", [
  "expense",
  "income",
  "transfer",
]);

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: accountType("type").notNull().default("other"),
  currency: currency("currency").notNull().default("IDR"),
  // Extra words the bot accepts for this account, e.g. ["bca", "m-banking"].
  aliases: text("aliases").array().notNull().default([]),
  initialBalance: bigint("initial_balance", { mode: "number" }).notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    kind: categoryKind("kind").notNull(),
    icon: text("icon").notNull().default(""),
    // Extra words that put a chat in this category, e.g. ["latte", "starbucks"].
    keywords: text("keywords").array().notNull().default([]),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("categories_name_kind").on(t.name, t.kind)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    type: transactionType("type").notNull(),
    // In the source account's currency.
    amount: bigint("amount", { mode: "number" }).notNull(),
    // Transfers between currencies: what arrived, in the destination account's currency.
    toAmount: bigint("to_amount", { mode: "number" }),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    // Null for transfers.
    categoryId: integer("category_id").references(() => categories.id),
    // Source account (for transfers: where the money leaves).
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    // Only for transfers: where the money arrives.
    toAccountId: integer("to_account_id").references(() => accounts.id),
    note: text("note").notNull().default(""),
    rawText: text("raw_text"),
    source: text("source").notNull().default("telegram"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_occurred_on_idx").on(t.occurredOn),
    index("transactions_category_idx").on(t.categoryId),
  ],
);

// Real balance of an account at the end of a day (from the month-end check).
// Balances are computed from the latest snapshot plus transactions after it.
export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    takenOn: date("taken_on", { mode: "string" }).notNull(),
    balance: bigint("balance", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("balance_snapshots_account_day").on(t.accountId, t.takenOn)],
);

// USD -> IDR rate per day. "auto" rates are fetched daily; "manual" ones are typed in and win.
export const fxRates = pgTable("fx_rates", {
  rateOn: date("rate_on", { mode: "string" }).primaryKey(),
  usdIdr: doublePrecision("usd_idr").notNull(),
  source: text("source").notNull().default("auto"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Monthly limit per expense category, applied to every month.
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .unique()
    .references(() => categories.id, { onDelete: "cascade" }),
  monthlyLimit: bigint("monthly_limit", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Telegram resends an update if the webhook is slow; this stops double entries.
export const telegramUpdates = pgTable("telegram_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Transactions that repeat on a day of the month (rent, subscriptions, installments).
// The daily cron creates them; `lastRunMonth` ("YYYY-MM") stops double creation.
export const recurring = pgTable("recurring", {
  id: serial("id").primaryKey(),
  type: transactionType("type").notNull(),
  // In the account's currency, like transactions.amount.
  amount: bigint("amount", { mode: "number" }).notNull(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  note: text("note").notNull().default(""),
  // 1-31; months that are shorter use their last day.
  dayOfMonth: integer("day_of_month").notNull(),
  active: boolean("active").notNull().default(true),
  lastRunMonth: text("last_run_month"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
