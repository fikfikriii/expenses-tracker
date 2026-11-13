/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the database layer.
const store = vi.hoisted(() => ({
  txs: [] as any[],
  updates: new Set<number>(),
  users: new Map<number, any>(), // telegramId -> user
  passwords: [] as { userId: number; password: string }[],
}));

vi.mock("@/lib/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/users")>()),
  ensureUser: async (telegramId: number, name: string, username?: string | null) => {
    const prev = store.users.get(telegramId);
    const user = {
      id: prev?.id ?? store.users.size + 1, telegramId, name,
      username: username ? username.toLowerCase() : null,
      passwordHash: prev?.passwordHash ?? null,
    };
    store.users.set(telegramId, user);
    return user;
  },
  setPassword: async (userId: number, password: string) => {
    if (password.length < 8) return { ok: false, error: "Password minimal 8 karakter." };
    store.passwords.push({ userId, password });
    return { ok: true };
  },
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
  saveDraft: async (userId: number, d: any, raw: string) => {
    const tx = {
      id: store.txs.length + 1, userId, type: d.type, amount: d.amount, occurredOn: d.date,
      accountId: d.accountId, toAccountId: d.toAccountId ?? null,
      categoryId: d.categoryId ?? null, note: d.note, rawText: raw,
    };
    store.txs.push(tx);
    return tx;
  },
  getTransaction: async (userId: number, id: number) =>
    store.txs.find((t) => t.id === id && t.userId === userId),
  setTransactionCategory: async () => undefined,
  deleteTransaction: async (userId: number, id: number) => {
    const i = store.txs.findIndex((t) => t.id === id && t.userId === userId);
    return i < 0 ? undefined : store.txs.splice(i, 1)[0];
  },
  lastTransaction: async (userId: number) => store.txs.filter((t) => t.userId === userId).at(-1),
  summarize: async () => ({ expense: 0, income: 0, byCategory: [] }),
  budgetStatus: async () => ({ limit: 100000, spent: 90000 }),
  loadBalanceBook: async () => ({ accounts: [], totals: () => ({ cash: 0, investment: 0, netWorth: 0 }), rate: () => null }),
  listAllAccounts: async () => [],
  saveSnapshots: async () => {},
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
const textUpdate = (from: number, text: string, opts: { username?: string; replyTo?: any } = {}) => ({
  update_id: ++n,
  message: {
    message_id: n, date: 0, text,
    chat: { id: from, type: "private" as const, first_name: "F" },
    from: { id: from, is_bot: false, first_name: "F", ...(opts.username ? { username: opts.username } : {}) },
    ...(opts.replyTo ? { reply_to_message: opts.replyTo } : {}),
    ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] } : {}),
  },
});

describe("bot", () => {
  beforeEach(() => {
    store.txs.length = 0;
    store.users.clear();
    store.passwords.length = 0;
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

  it("keeps each allowed user's data separate", async () => {
    process.env.ALLOWED_TELEGRAM_USER_IDS = "42,43";
    const { bot, sent } = makeBot();
    await bot.handleUpdate(textUpdate(42, "15000 makan bubur") as any);
    await bot.handleUpdate(textUpdate(43, "20000 makan soto") as any);
    expect(store.txs.map((t) => [t.userId, t.amount])).toEqual([[1, 15000], [2, 20000]]);

    // User 43 can't undo user 42's transaction (callback "u:1").
    sent.length = 0;
    await bot.handleUpdate({
      update_id: ++n,
      callback_query: {
        id: "1", chat_instance: "x", data: "u:1",
        from: { id: 43, is_bot: false, first_name: "F" },
        message: { message_id: 1, date: 0, chat: { id: 43, type: "private", first_name: "F" } },
      },
    } as any);
    expect(store.txs).toHaveLength(2);
  });

  it("lets anyone in when the allowlist is *", async () => {
    process.env.ALLOWED_TELEGRAM_USER_IDS = "*";
    const { bot } = makeBot();
    await bot.handleUpdate(textUpdate(999, "15000 makan") as any);
    expect(store.txs).toHaveLength(1);
  });

  describe("dashboard password", () => {
    const promptReply = (text: string, username = "fikri") => {
      const promptMsg = { message_id: 500, date: 0, chat: { id: 42, type: "private" }, from: { id: 1, is_bot: true, first_name: "t" }, text: PROMPT };
      return textUpdate(42, text, { username, replyTo: promptMsg });
    };
    // Same text the bot sends; asserted below so a wording change shows up here.
    const PROMPT = "🔑 Bikin password dashboard (minimal 8 karakter). Ketik password-nya di sini, balas pesan ini.";

    it("asks a new user for a password on /start", async () => {
      const { bot, sent } = makeBot();
      await bot.handleUpdate(textUpdate(42, "/start", { username: "Fikri" }) as any);
      const msgs = sent.filter((s) => s.method === "sendMessage");
      expect(msgs[0].payload.text).toContain("Cara pakai");
      expect(msgs[1].payload.text).toBe(PROMPT);
      expect(msgs[1].payload.reply_markup.force_reply).toBe(true);
    });

    it("saves a replied password, deletes the messages, and never logs it as an expense", async () => {
      const { bot, sent } = makeBot();
      await bot.handleUpdate(textUpdate(42, "/start", { username: "fikri" }) as any);
      sent.length = 0;
      await bot.handleUpdate(promptReply("rahasia12345") as any);
      expect(store.passwords).toEqual([{ userId: 1, password: "rahasia12345" }]);
      expect(store.txs).toHaveLength(0);
      expect(sent.filter((s) => s.method === "deleteMessage")).toHaveLength(2);
      const done = sent.find((s) => s.method === "sendMessage")!;
      expect(done.payload.text).toContain("Password dashboard disimpan");
      expect(done.payload.text).toContain("<code>fikri</code>");
      expect(done.payload.text).not.toContain("rahasia12345");
    });

    it("rejects a short password but still deletes it from the chat", async () => {
      const { bot, sent } = makeBot();
      await bot.handleUpdate(textUpdate(42, "/start", { username: "fikri" }) as any);
      sent.length = 0;
      await bot.handleUpdate(promptReply("pendek") as any);
      expect(store.passwords).toHaveLength(0);
      expect(sent.some((s) => s.method === "deleteMessage")).toBe(true);
      expect(sent.find((s) => s.method === "sendMessage")!.payload.text).toContain("minimal 8");
    });

    it("needs a Telegram username to log in", async () => {
      const { bot, sent } = makeBot();
      await bot.handleUpdate(textUpdate(42, "/password") as any);
      expect(sent[0].payload.text).toContain("username Telegram");
      expect(sent[0].payload.reply_markup).toBeUndefined();
    });
  });

  it("answers /bantuan", async () => {
    const { bot, sent } = makeBot();
    await bot.handleUpdate(textUpdate(42, "/bantuan") as any);
    expect(sent[0].payload.text).toContain("Cara pakai");
  });
});
