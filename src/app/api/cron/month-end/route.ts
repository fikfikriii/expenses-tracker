import { Api } from "grammy";
import { addDays, formatMonthId, todayJakarta } from "@/lib/dates";
import { ensureTodayRate } from "@/lib/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Runs daily (see vercel.json): stores the day's USD rate, and on the last day of the month
// reminds the owner to update balances.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const fromVercelCron = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !fromVercelCron) {
    return new Response("unauthorized", { status: 401 });
  }

  // Store today's USD rate even when nobody opens the app.
  await ensureTodayRate().catch((e) => console.error("FX", e));

  const today = todayJakarta();
  const force = new URL(req.url).searchParams.get("force") === "1";
  const isLastDay = addDays(today, 1).slice(8, 10) === "01";
  if (!isLastDay && !force) return Response.json({ sent: 0, reason: "not the last day" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const api = new Api(token);
  const ids = (process.env.ALLOWED_TELEGRAM_USER_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n > 0);

  const text = [
    `👀 Akhir ${formatMonthId(today)}, waktunya update saldo!`,
    "",
    "Cek saldo tiap akun (termasuk investasi), terus kirim kayak gini:",
    "<code>saldo bca 5,2jt mandiri 3,1jt seabank 800rb</code>",
    "",
    "Nanti gua hitungin selisih yang belum kecatat bulan ini.",
  ].join("\n");

  let sent = 0;
  for (const id of ids) {
    await api.sendMessage(id, text, { parse_mode: "HTML" }).then(() => sent++, (e) => console.error(e));
  }
  return Response.json({ sent });
}
