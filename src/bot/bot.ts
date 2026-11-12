import { Bot, InlineKeyboard, type Context } from "grammy";
import { interpret } from "@/lib/interpret";
import {
  budgetStatus,
  claimTelegramUpdate,
  deleteTransaction,
  getTransaction,
  lastTransaction,
  listAccounts,
  listCategories,
  saveDraft,
  setTransactionCategory,
  summarize,
} from "@/lib/ledger";
import { formatDateId, formatMonthId, formatRupiah, monthRange, todayJakarta } from "@/lib/dates";
import type { Transaction } from "@/db/schema";

const HELP = [
  "<b>Cara pakai</b>",
  "Kirim pengeluaran atau pemasukan dengan bahasa biasa:",
  "• <code>15000 makan bubur</code>",
  "• <code>kemarin 25rb bensin</code>",
  "• <code>5 November 2026, 15000 makan bubur</code>",
  "• <code>50rb bensin pake bca</code>",
  "• <code>gajian 8jt</code> atau <code>+500rb freelance</code>",
  "• <code>transfer 1jt bca ke gopay</code>",
  "",
  "<b>Command</b>",
  "/hari_ini – ringkasan hari ini",
  "/bulan_ini – ringkasan bulan ini",
  "/hapus – hapus transaksi terakhir",
  "/bantuan – pesan ini",
].join("\n");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function allowedUserIds(): Set<number> {
  return new Set(
    (process.env.ALLOWED_TELEGRAM_USER_IDS ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
}

async function describe(tx: Transaction): Promise<string> {
  const [accounts, categories] = await Promise.all([listAccounts(), listCategories()]);
  const acc = (id: number | null) => accounts.find((a) => a.id === id)?.name ?? "?";
  const cat = categories.find((c) => c.id === tx.categoryId);
  const date = formatDateId(tx.occurredOn);

  if (tx.type === "transfer") {
    return [
      "🔁 <b>Transfer dicatat</b>",
      `${formatRupiah(tx.amount)} · ${escapeHtml(acc(tx.accountId))} → ${escapeHtml(acc(tx.toAccountId))}`,
      `📅 ${date}`,
    ].join("\n");
  }
  const title = tx.type === "income" ? "💰 <b>Pemasukan dicatat</b>" : "💸 <b>Pengeluaran dicatat</b>";
  return [
    title,
    `${formatRupiah(tx.amount)} · ${cat ? `${cat.icon} ${escapeHtml(cat.name)}`.trim() : "Tanpa kategori"}`,
    tx.note ? `📝 ${escapeHtml(tx.note)}` : null,
    `📅 ${date} · 👛 ${escapeHtml(acc(tx.accountId))}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function budgetWarning(tx: Transaction): Promise<string | null> {
  if (tx.type !== "expense" || !tx.categoryId) return null;
  const status = await budgetStatus(tx.categoryId, tx.occurredOn);
  if (!status || status.limit <= 0) return null;
  const pct = Math.round((status.spent / status.limit) * 100);
  if (pct < 80) return null;
  const cats = await listCategories();
  const name = cats.find((c) => c.id === tx.categoryId)?.name ?? "";
  const head = pct >= 100 ? "🚨 Budget" : "⚠️ Budget";
  return `${head} ${escapeHtml(name)} udah ${pct}% (${formatRupiah(status.spent)} dari ${formatRupiah(status.limit)})`;
}

function txKeyboard(tx: Transaction) {
  const kb = new InlineKeyboard();
  if (tx.type !== "transfer") kb.text("🏷️ Ganti kategori", `c:${tx.id}`);
  return kb.text("↩️ Batal", `u:${tx.id}`);
}

async function summaryText(title: string, start: string, end: string): Promise<string> {
  const s = await summarize(start, end);
  if (s.expense === 0 && s.income === 0) return `<b>${title}</b>\nBelum ada transaksi.`;
  const lines = [
    `<b>${title}</b>`,
    `💸 Pengeluaran: ${formatRupiah(s.expense)}`,
    `💰 Pemasukan: ${formatRupiah(s.income)}`,
    `📊 Selisih: ${formatRupiah(s.income - s.expense)}`,
  ];
  const top = s.byCategory.filter((c) => c.kind === "expense").slice(0, 8);
  if (top.length) {
    lines.push("", "<b>Pengeluaran per kategori</b>");
    for (const c of top) lines.push(`${c.icon} ${escapeHtml(c.name)}: ${formatRupiah(c.total)}`.trim());
  }
  return lines.join("\n");
}

export function createBot(token: string) {
  const bot = new Bot<Context>(token);

  // Skip updates Telegram resends after a slow response.
  bot.use(async (ctx, next) => {
    if (await claimTelegramUpdate(ctx.update.update_id)) await next();
  });

  // Private bot: only the owner's Telegram account may use it.
  bot.use(async (ctx, next) => {
    const id = ctx.from?.id;
    const allowed = allowedUserIds();
    if (id && allowed.has(id)) return next();
    if (ctx.chat?.type === "private" && id) {
      await ctx.reply(
        allowed.size === 0
          ? `Bot belum dikunci. ID Telegram lu: <code>${id}</code>\nIsi env <code>ALLOWED_TELEGRAM_USER_IDS</code> di Vercel dengan angka ini, lalu redeploy.`
          : "Maaf, bot ini private.",
        { parse_mode: "HTML" },
      );
    }
  });

  bot.command(["start", "bantuan", "help"], (ctx) => ctx.reply(HELP, { parse_mode: "HTML" }));

  bot.command("hari_ini", async (ctx) => {
    const today = todayJakarta();
    await ctx.reply(await summaryText(`Hari ini (${formatDateId(today)})`, today, today), {
      parse_mode: "HTML",
    });
  });

  bot.command("bulan_ini", async (ctx) => {
    const today = todayJakarta();
    const { start, end } = monthRange(today);
    await ctx.reply(await summaryText(formatMonthId(today), start, end), { parse_mode: "HTML" });
  });

  bot.command("hapus", async (ctx) => {
    const tx = await lastTransaction();
    if (!tx) return ctx.reply("Belum ada transaksi.");
    await deleteTransaction(tx.id);
    await ctx.reply(`🗑️ Dihapus:\n${await describe(tx)}`, { parse_mode: "HTML" });
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return ctx.reply("Command nggak dikenal. Coba /bantuan");

    const [accounts, categories] = await Promise.all([listAccounts(), listCategories()]);
    const result = await interpret(text, { today: todayJakarta(), accounts, categories });
    if (!result.ok) {
      return ctx.reply(
        "Nominalnya nggak kebaca 🤔 Contoh: <code>15000 makan bubur</code>. Ketik /bantuan buat contoh lain.",
        { parse_mode: "HTML" },
      );
    }

    const tx = await saveDraft(result.draft, text);
    const warning = await budgetWarning(tx);
    const body = [await describe(tx), warning].filter(Boolean).join("\n\n");
    await ctx.reply(body, { parse_mode: "HTML", reply_markup: txKeyboard(tx) });
  });

  // c:<txId> -> show category choices
  bot.callbackQuery(/^c:(\d+)$/, async (ctx) => {
    const tx = await getTransaction(Number(ctx.match[1]));
    if (!tx || tx.type === "transfer") return ctx.answerCallbackQuery("Transaksi nggak ada");
    const cats = (await listCategories()).filter((c) => c.kind === tx.type);
    const kb = new InlineKeyboard();
    cats.forEach((c, i) => {
      kb.text(`${c.icon} ${c.name}`.trim(), `s:${tx.id}:${c.id}`);
      if (i % 2 === 1) kb.row();
    });
    await ctx.editMessageReplyMarkup({ reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  // s:<txId>:<categoryId> -> set category
  bot.callbackQuery(/^s:(\d+):(\d+)$/, async (ctx) => {
    const tx = await setTransactionCategory(Number(ctx.match[1]), Number(ctx.match[2]));
    if (!tx) return ctx.answerCallbackQuery("Transaksi nggak ada");
    const warning = await budgetWarning(tx);
    const body = [await describe(tx), warning].filter(Boolean).join("\n\n");
    await ctx.editMessageText(body, { parse_mode: "HTML", reply_markup: txKeyboard(tx) });
    await ctx.answerCallbackQuery("Kategori diganti");
  });

  // u:<txId> -> undo
  bot.callbackQuery(/^u:(\d+)$/, async (ctx) => {
    const tx = await deleteTransaction(Number(ctx.match[1]));
    if (!tx) return ctx.answerCallbackQuery("Udah dihapus");
    await ctx.editMessageText(`<s>${await describe(tx)}</s>\n\n↩️ Dibatalin`, { parse_mode: "HTML" });
    await ctx.answerCallbackQuery("Dibatalin");
  });

  bot.catch(async (err) => {
    console.error("Bot error", err.error);
    await err.ctx.reply("Waduh, ada error. Coba lagi bentar ya.").catch(() => {});
  });

  return bot;
}
