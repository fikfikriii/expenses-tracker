import { addDays, formatDateId, formatMonthId, formatRupiah, monthRange } from "./dates";
import { listAllCategories, listBudgets, summarize, type Summary } from "./ledger";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type BudgetLine = { name: string; spent: number; limit: number };

/** "naik 20% dari ..." / "turun 5% ..." / "sama kayak ..." for expenses against the previous period. */
export function compareLine(now: number, before: number, label: string): string {
  if (before <= 0) return now > 0 ? `Periode ${label} nggak ada pengeluaran buat dibandingin.` : "";
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return `Sama kayak ${label} (${formatRupiah(before)}).`;
  return `${pct > 0 ? "📈 Naik" : "📉 Turun"} ${Math.abs(pct)}% dari ${label} (${formatRupiah(before)}).`;
}

export function formatReport(opts: {
  title: string;
  summary: Summary;
  previous: Summary;
  previousLabel: string;
  budgets: BudgetLine[];
}): string {
  const { summary, previous, budgets } = opts;
  const expenses = summary.byCategory.filter((c) => c.kind === "expense").slice(0, 3);
  const net = summary.income - summary.expense;
  const lines = [
    `<b>${esc(opts.title)}</b>`,
    "",
    `Pemasukan: ${formatRupiah(summary.income)}`,
    `Pengeluaran: ${formatRupiah(summary.expense)}`,
    `Selisih: ${net < 0 ? "-" : ""}${formatRupiah(Math.abs(net))}`,
  ];
  const cmp = compareLine(summary.expense, previous.expense, opts.previousLabel);
  if (cmp) lines.push("", cmp);
  if (expenses.length > 0) {
    lines.push("", "<b>Terbesar</b>");
    expenses.forEach((c, i) =>
      lines.push(
        `${i + 1}. ${esc(`${c.icon} ${c.name}`.trim())} ${formatRupiah(c.total)} (${Math.round((c.total / Math.max(1, summary.expense)) * 100)}%)`,
      ),
    );
  }
  const hot = budgets.filter((b) => b.limit > 0 && b.spent / b.limit >= 0.8).sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  if (hot.length > 0) {
    lines.push("", "<b>Budget</b>");
    for (const b of hot) {
      const pct = Math.round((b.spent / b.limit) * 100);
      lines.push(`${pct >= 100 ? "🚨" : "⚠️"} ${esc(b.name)} ${pct}% (${formatRupiah(b.spent)} / ${formatRupiah(b.limit)})`);
    }
  } else if (budgets.length > 0) {
    lines.push("", "✅ Semua budget masih aman.");
  }
  if (summary.expense === 0 && summary.income === 0) return `<b>${esc(opts.title)}</b>\n\nBelum ada transaksi tercatat.`;
  return lines.join("\n");
}

async function budgetLines(userId: number, monthIso: string): Promise<BudgetLine[]> {
  const { start, end } = monthRange(monthIso);
  const [budgets, cats, month] = await Promise.all([listBudgets(userId), listAllCategories(userId), summarize(userId, start, end)]);
  return budgets.flatMap((b) => {
    const c = cats.find((x) => x.id === b.categoryId);
    if (!c) return [];
    const spent = month.byCategory.find((x) => x.kind === "expense" && x.name === c.name)?.total ?? 0;
    return [{ name: c.name, spent, limit: b.monthlyLimit }];
  });
}

/** Mon-Sun week ending on `sunday` (YYYY-MM-DD), compared with the week before. */
export async function weeklyReport(userId: number, sunday: string): Promise<string> {
  const start = addDays(sunday, -6);
  const [summary, previous, budgets] = await Promise.all([
    summarize(userId, start, sunday),
    summarize(userId, addDays(start, -7), addDays(start, -1)),
    budgetLines(userId, sunday),
  ]);
  return formatReport({
    title: `📊 Laporan mingguan (${formatDateId(start)} - ${formatDateId(sunday)})`,
    summary,
    previous,
    previousLabel: "minggu lalu",
    budgets,
  });
}

/** The whole month that contains `monthIso`, compared with the month before. */
export async function monthlyReport(userId: number, monthIso: string): Promise<string> {
  const { start, end } = monthRange(monthIso);
  const prev = monthRange(addDays(start, -1));
  const [summary, previous, budgets] = await Promise.all([
    summarize(userId, start, end),
    summarize(userId, prev.start, prev.end),
    budgetLines(userId, monthIso),
  ]);
  return formatReport({
    title: `🗓️ Laporan ${formatMonthId(monthIso)}`,
    summary,
    previous,
    previousLabel: formatMonthId(prev.start),
    budgets,
  });
}
