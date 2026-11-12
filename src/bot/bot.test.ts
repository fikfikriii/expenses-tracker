/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the database layer.
const store = vi.hoisted(() => ({
  txs: [] as any[],
  updates: new Set<number>(),
}));

vi.mock("@/lib/ledger", () => ({
  listAccounts: async () => [
    { id: 1, name: "Cash", aliases: [], isDefault: true },
    { id: 2, name: "BCA", aliases: [], isDefault: false },
  ],
  listCategories: async () => [
    { id: 1, name: "Makan & Minum", kind: "expense", icon: "🍜" },
    { id: 10, name: "Lainnya", kind: "expense", icon: "📦" },
    { id: 14, name: "Pemasukan Lain", kind: "income", icon: "💰" },
  ],
  claimTelegramUpdate: async (id: number) =>
    store.updates.has(id) ? false : (store.updates.add(id), true),
  saveDraft: async (d: any, raw: string) => {
    const tx = {
      id: store.txs.length + 1, type: d.type, amount: d.amount, occurredOn: d.date,
      accountId: d.accountId, toAccountId: d.toAccountId ?? null,
      categoryId: d.categoryId ?? null, note: d.note, rawText: raw,
    };
    store.txs.push(tx);
    return tx;
  },
  getTransaction: async (id: number) => store.txs.find((t) => t.id === id),
  setTransactionCategory: async () => undefined,
  deleteTransaction: async () => undefined,
  lastTransaction: async () => store.txs.at(-1),
  summarize: async () => ({ expense: 0, income: 0, byCategory: [] }),
  budgetStatus: async () => ({ limit: 100000, spent: 90000 }),
}));

import { createBot } from "./bot";

function makeBot() {
  const bot = createBot("123:test");
  bot.botInfo = { id: 1, is_bot: true, first_name: "t", username: "t_bot" } as any;
  const sent: { method: string; payload: any }[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload });
    return { ok: true, result: true } as any;
  });
  return { bot, sent };
}

let n = 0;
const textUpdate = (from: number, text: string) => ({
  update_id: ++n,
  message: {
    message_id: n, date: 0, text,
    chat: { id: from, type: "private" as const, first_name: "F" },
    from: { id: from, is_bot: false, first_name: "F" },
    ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] } : {}),
  },
});

describe("bot", () => {
  beforeEach(() => {
    store.txs.length = 0;
    process.env.ALLOWED_TELEGRAM_USER_IDS = "42";
    delete process.env.AI_API_KEY;
  });

  it("logs an expense and warns about the budget", async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(textUpdate(42, "15000 makan bubur") as any);
    expect(store.txs[0]).toMatchObject({ amount: 15000, categoryId: 1 });
    const reply = sent.find((s) => s.method === "sendMessage")!;
    expect(reply.payload.text).toContain("Rp15.000");
    expect(reply.payload.text).toContain("Budget Makan &amp; Minum udah 90%");
    expect(reply.payload.reply_markup.inline_keyboard[0][0].callback_data).toBe("c:1");
  });

  it("ignores a resent update", async () => {
    const { bot } = makeBot();
    const u = textUpdate(42, "15000 makan") as any;
    await bot.handleUpdate(u);
    await bot.handleUpdate(u);
    expect(store.txs).toHaveLength(1);
  });

  it("blocks strangers", async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(textUpdate(7, "15000 makan") as any);
    expect(store.txs).toHaveLength(0);
    expect(sent[0].payload.text).toContain("private");
  });

  it("tells the owner their ID when no one is allowed yet", async () => {
    process.env.ALLOWED_TELEGRAM_USER_IDS = "";
    const { bot, sent } = makeBot();
    await bot.handleUpdate(textUpdate(7, "halo") as any);
    expect(sent[0].payload.text).toContain("<code>7</code>");
  });

  it("answers /bantuan", async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(textUpdate(42, "/bantuan") as any);
    expect(sent[0].payload.text).toContain("Cara pakai");
  });
});
