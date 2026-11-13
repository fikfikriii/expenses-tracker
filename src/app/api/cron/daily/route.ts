import { Api } from "grammy";
import { addDays, formatDateId, formatMonthId, formatRupiah, todayJakarta } from "@/lib/dates";
import { ensureTodayRate } from "@/lib/fx";
import { runRecurring } from "@/lib/recurring";
import { monthlyReport, weeklyReport } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Day of week in Jakarta for a YYYY-MM-DD date, 0 = Sunday. */
function weekday(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// Runs once a day around 19:00 WIB (see vercel.json). It
//  - stores the day's USD rate,
//  - creates today's recurring transactions,
//  - sends the weekly report on Sunday and the monthly report on the 1st,
//  - reminds the owner to update balances on the last day of the month.
// `?force=month-end|weekly|monthly` sends that message regardless of the date (for testing).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const fromVercelCron = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !fromVercelCron) {
    return new Response("unauthorized", { status: 401 });
  }

  await ensureTodayRate().catch((e) => console.error("FX", e));

  const today = todayJakarta();
  const force = new URL(req.url).searchParams.get("force");
  const messages: string[] = [];

  let recurringCreated = 0;
  try {
    const created = await runRecurring(today);
    recurringCreated = created.length;
    if (created.length > 0) {
      messages.push(
        [
          "🔁 Transaksi rutin hari ini dicatat:",
          ...created.map(
            (c) => `• ${c.rule.note || (c.rule.type === "income" ? "Pemasukan" : "Pengeluaran")} ${formatRupiah(c.rule.amount)}`,
          ),
        ].join("\n"),
      );
    }
  } catch (e) {
    console.error("recurring", e);
  }

  try {
    if (weekday(today) === 0 || force === "weekly") messages.push(await weeklyReport(today));
    if (today.slice(8, 10) === "01" || force === "monthly") {
      messages.push(await monthlyReport(addDays(today, -1).slice(0, 7) + "-01"));
    }
  } catch (e) {
    console.error("report", e);
  }

  if (addDays(today, 1).slice(8, 10) === "01" || force === "month-end") {
    messages.push(
      [
        `👀 Akhir ${formatMonthId(today)}, waktunya update saldo!`,
        "",
        "Cek saldo tiap akun (termasuk investasi), terus kirim kayak gini:",
        "<code>saldo bca 5,2jt mandiri 3,1jt seabank 800rb</code>",
        "",
        "Nanti gua hitungin selisih yang belum kecatat bulan ini.",
      ].join("\n"),
    );
  }

  if (messages.length === 0) return Response.json({ sent: 0, recurringCreated, date: formatDateId(today) });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const api = new Api(token);
  const ids = (process.env.ALLOWED_TELEGRAM_USER_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n > 0);

  let sent = 0;
  for (const id of ids) {
    for (const text of messages) {
      await api.sendMessage(id, text, { parse_mode: "HTML" }).then(() => sent++, (e) => console.error(e));
    }
  }
  return Response.json({ sent, recurringCreated });
}
