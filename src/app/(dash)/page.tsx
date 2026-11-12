import Link from "next/link";
import { TxList } from "@/components/tx-list";
import { accountTypeLabel } from "@/lib/labels";
import { formatDateId, formatMonthId, formatRupiah, monthRange, todayJakarta } from "@/lib/dates";
import { isInvestment } from "@/lib/balances";
import { formatMoney, type Currency } from "@/lib/money";
import {
  listAllAccounts,
  loadBalanceBook,
  listAllCategories,
  recentTransactions,
  summarize,
} from "@/lib/ledger";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function Overview({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const today = todayJakarta();
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : today.slice(0, 7);
  const { start, end } = monthRange(`${month}-01`);

  const [summary, book, accounts, categories, recent] = await Promise.all([
    summarize(start, end),
    loadBalanceBook(),
    listAllAccounts(),
    listAllCategories(),
    recentTransactions(8),
  ]);

  const active = accounts.filter((a) => !a.archived);
  // Balances as of the end of the shown month (or today for the current month).
  const asOf = end < today ? end : today;
  const usdRate = active.some((a) => a.currency === "USD") ? book.rate(asOf) : undefined;
  const totals = book.totals(asOf);
  const cashAccounts = active.filter((a) => !isInvestment(a));
  const investAccounts = active.filter(isInvestment);
  const unrecordedParts = book.unrecorded().filter((u) => u.takenOn >= start && u.takenOn <= end);
  const unrecorded = unrecordedParts.reduce((s, u) => s + u.diff, 0);
  const trend = netWorthTrend(book, month, today);
  const expenseCats = summary.byCategory.filter((c) => c.kind === "expense");
  const maxCat = Math.max(1, ...expenseCats.map((c) => c.total));
  const net = summary.income - summary.expense;
  const isCurrent = month === today.slice(0, 7);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{formatMonthId(`${month}-01`)}</h1>
        <div className="flex gap-1">
          <Link className="btn" href={`/?month=${shiftMonth(month, -1)}`}>←</Link>
          {!isCurrent && <Link className="btn" href="/">Bulan ini</Link>}
          <Link className="btn" href={`/?month=${shiftMonth(month, 1)}`}>→</Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pemasukan" value={formatRupiah(summary.income)} tone="text-green-600" />
        <Stat label="Pengeluaran" value={formatRupiah(summary.expense)} />
        <Stat
          label="Selisih"
          value={`${net < 0 ? "−" : ""}${formatRupiah(Math.abs(net))}`}
          tone={net < 0 ? "text-red-600" : "text-green-600"}
        />
        <Stat
          label="Total kekayaan"
          value={formatRupiah(totals.netWorth)}
          sub={totals.investment ? `Kas ${formatRupiah(totals.cash)} · Investasi ${formatRupiah(totals.investment)}` : undefined}
        />
      </section>

      {unrecordedParts.length > 0 && (
        <Link href="/balances" className="card flex items-center justify-between gap-3 hover:opacity-90">
          <div>
            <div className="text-sm font-medium">Selisih tak tercatat bulan ini</div>
            <div className="text-xs text-muted">
              {unrecorded > 0
                ? "Kemungkinan bunga, cashback, atau pemasukan yang belum dicatat."
                : unrecorded < 0
                  ? "Ada pengeluaran yang belum dicatat."
                  : "Semua kecatat, mantap."}
            </div>
          </div>
          <div className={`text-lg font-semibold tabular-nums ${unrecorded < 0 ? "text-red-600" : unrecorded > 0 ? "text-green-600" : ""}`}>
            {unrecorded === 0 ? "Rp0 ✓" : `${unrecorded < 0 ? "−" : "+"}${formatRupiah(Math.abs(unrecorded))}`}
          </div>
        </Link>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Pengeluaran per kategori</h2>
            <Link className="text-xs text-muted hover:underline" href={`/transactions?type=expense&from=${start}&to=${end}`}>
              Lihat semua
            </Link>
          </div>
          {expenseCats.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Belum ada pengeluaran bulan ini.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {expenseCats.map((c) => (
                <li key={c.name} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{`${c.icon} ${c.name}`.trim()}</span>
                    <span className="tabular-nums">
                      {formatRupiah(c.total)}{" "}
                      <span className="text-xs text-muted">
                        {Math.round((c.total / Math.max(1, summary.expense)) * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-neutral-800 dark:bg-neutral-200"
                      style={{ width: `${(c.total / maxCat) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Saldo akun</h2>
            <Link className="text-xs text-muted hover:underline" href="/accounts">Kelola</Link>
          </div>
          <AccountGroup title="Kas & bank" accounts={cashAccounts} book={book} date={asOf} />
          {investAccounts.length > 0 && (
            <AccountGroup title="Investasi" accounts={investAccounts} book={book} date={asOf} showCapital />
          )}
          {usdRate !== undefined && (
            <p className="text-xs text-muted">
              {usdRate ? `Kurs USD: ${formatRupiah(usdRate)}` : "Kurs USD belum ada. Isi di halaman Saldo."}
            </p>
          )}
          <Link href="/balances" className="btn self-start">🏦 Update saldo</Link>
        </div>
      </section>

      {trend.length > 1 && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-medium">Total kekayaan per bulan</h2>
          <NetWorthBars data={trend} />
        </section>
      )}

      <section className="card flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Transaksi terakhir</h2>
          <Link className="text-xs text-muted hover:underline" href="/transactions">Semua transaksi</Link>
        </div>
        <TxList rows={recent} accounts={accounts} categories={categories} />
      </section>
    </>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

type Acc = { id: number; name: string; type: string; currency: Currency };
type Book = Awaited<ReturnType<typeof loadBalanceBook>>;

function AccountGroup({ title, accounts, book, date, showCapital }: {
  title: string;
  accounts: Acc[];
  book: Book;
  date: string;
  showCapital?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{title}</div>
      <ul className="divide-y divide-border">
        {accounts.map((a) => {
          const native = book.balanceAt(a.id, date);
          const idr = book.valueIdr(a.id, date);
          const checked = book.lastSnapshot(a.id, date)?.takenOn;
          const cap = showCapital ? book.capitalIdr(a.id, date) : 0;
          const gain = cap > 0 ? idr - cap : null;
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <Link href={`/transactions?account=${a.id}`} className="min-w-0 hover:underline">
                <div className="truncate">{a.name}</div>
                <div className="text-xs text-muted">
                  {accountTypeLabel(a.type)}
                  {a.currency !== "IDR" && ` · ${a.currency}`}
                  {checked ? ` · cek ${formatDateId(checked)}` : " · belum pernah cek"}
                </div>
              </Link>
              <div className="text-right">
                <div className={`tabular-nums ${native < 0 ? "text-red-600" : ""}`}>{formatMoney(native, a.currency)}</div>
                {a.currency !== "IDR" && (
                  <div className="text-xs tabular-nums text-muted">≈ {formatRupiah(idr)}</div>
                )}
                {gain !== null && (
                  <div className={`text-xs tabular-nums ${gain < 0 ? "text-red-600" : "text-green-600"}`}>
                    modal {formatRupiah(cap)} · {gain < 0 ? "−" : "+"}{Math.abs(Math.round((gain / cap) * 1000) / 10)}%
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type TrendPoint = { month: string; cash: number; investment: number };

/** Month-end net worth for up to 12 months ending at `month`, starting from the first data. */
function netWorthTrend(book: Book, month: string, today: string): TrendPoint[] {
  const dates = [
    ...book.txs.map((t) => t.occurredOn),
    ...book.accounts.flatMap((a) => book.snapshots(a.id).map((s) => s.takenOn)),
  ].sort();
  if (dates.length === 0) return [];
  const first = dates[0].slice(0, 7);
  const out: TrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = shiftMonth(month, -i);
    if (m < first || m > today.slice(0, 7)) continue;
    const { end } = monthRange(`${m}-01`);
    const t = book.totals(end < today ? end : today);
    out.push({ month: m, cash: t.cash, investment: t.investment });
  }
  return out;
}

function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1).replace(".0", "")}M`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace(".0", "")}jt`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}rb`;
  return `${sign}${abs}`;
}

function NetWorthBars({ data }: { data: TrendPoint[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(0, d.cash) + Math.max(0, d.investment)));
  const hasInv = data.some((d) => d.investment > 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-40 items-end gap-1.5">
        {data.map((d) => {
          const cashH = (Math.max(0, d.cash) / max) * 100;
          const invH = (Math.max(0, d.investment) / max) * 100;
          return (
            <div key={d.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-muted">{compact(d.cash + d.investment)}</span>
              <div className="flex w-full max-w-10 flex-col justify-end" style={{ height: "100%" }}>
                {invH > 0 && <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${invH}%` }} />}
                <div
                  className={`w-full bg-neutral-800 dark:bg-neutral-300 ${invH > 0 ? "" : "rounded-t"}`}
                  style={{ height: `${cashH}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {data.map((d) => (
          <div key={d.month} className="flex-1 text-center text-[10px] text-muted">
            {formatMonthId(`${d.month}-01`).slice(0, 3)}
          </div>
        ))}
      </div>
      {hasInv && (
        <div className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-neutral-800 dark:bg-neutral-300" />Kas & bank</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/70" />Investasi</span>
        </div>
      )}
    </div>
  );
}
