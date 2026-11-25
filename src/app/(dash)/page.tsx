import { requireUser } from "@/lib/session";
import Link from "next/link";
import { NetWorthCard } from "@/components/net-worth-card";
import { BudgetBar } from "@/components/budget-bar";
import { TxList } from "@/components/tx-list";
import { accountTypeLabel } from "@/lib/labels";
import { riskLabel, type Risk } from "@/lib/risk";
import { formatRate } from "@/lib/maturity";
import { daysBetween, formatDateId, formatPeriodId, formatRupiah, periodKey, periodRange, shiftMonth, todayJakarta } from "@/lib/dates";
import { isDeposit, isInvestment, netWorthTrend } from "@/lib/balances";
import { NetWorthBars } from "@/components/charts";
import { formatMoney, type Currency } from "@/lib/money";
import {
  listAllAccounts,
  loadBalanceBook,
  listAllCategories,
  listBudgets,
  recentTransactions,
  summarize,
} from "@/lib/ledger";

export default async function Overview({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const { month: monthParam } = await searchParams;
  const today = todayJakarta();
  const day = user.monthStartDay;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : periodKey(today, day);
  const { start, end } = periodRange(month, day);

  const [summary, book, accounts, categories, recent, budgets] = await Promise.all([
    summarize(user.id, start, end),
    loadBalanceBook(user.id),
    listAllAccounts(user.id),
    listAllCategories(user.id),
    recentTransactions(user.id, 8),
    listBudgets(user.id),
  ]);

  const active = accounts.filter((a) => !a.archived);
  // Balances as of the end of the shown month (or today for the current month).
  const asOf = end < today ? end : today;
  const usdRate = active.some((a) => a.currency === "USD") ? book.rate(asOf) : undefined;
  const totals = book.totals(asOf);
  const cashAccounts = active.filter((a) => !isInvestment(a));
  const investAccounts = active.filter((a) => isInvestment(a) && !isDeposit(a));
  const deposits = active
    .filter(isDeposit)
    .sort((a, b) => (a.maturityOn ?? "9999-12-31").localeCompare(b.maturityOn ?? "9999-12-31") || a.id - b.id);
  const depositTotal = deposits.reduce((sum, d) => sum + book.valueIdr(d.id, asOf), 0);
  const unrecordedParts = book.unrecorded().filter((u) => u.takenOn >= start && u.takenOn <= end);
  const unrecorded = unrecordedParts.reduce((s, u) => s + u.diff, 0);
  const trend = netWorthTrend(book, month, today, 12, day);
  const expenseCats = summary.byCategory.filter((c) => c.kind === "expense");
  const maxCat = Math.max(1, ...expenseCats.map((c) => c.total));
  const budgetRows = budgets
    .map((b) => {
      const c = categories.find((x) => x.id === b.categoryId);
      if (!c) return null;
      const spent = expenseCats.find((e) => e.name === c.name)?.total ?? 0;
      return { name: `${c.icon} ${c.name}`.trim(), spent, limit: b.monthlyLimit };
    })
    .filter((r): r is { name: string; spent: number; limit: number } => r !== null)
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const net = summary.income - summary.expense;
  const isCurrent = month === periodKey(today, day);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{formatPeriodId(month, day)}</h1>
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
        <NetWorthCard
          total={formatRupiah(totals.netWorth)}
          cash={formatRupiah(totals.cash)}
          investment={investAccounts.length + deposits.length > 0 ? formatRupiah(totals.investment) : null}
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

      {budgetRows.length > 0 && (
        <section className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Budget</h2>
            <Link className="text-xs text-muted hover:underline" href="/budgets">Atur</Link>
          </div>
          <ul className="flex flex-col gap-3">
            {budgetRows.map((r) => (
              <li key={r.name} className="flex flex-col gap-1">
                <span className="text-sm">{r.name}</span>
                <BudgetBar spent={r.spent} limit={r.limit} />
              </li>
            ))}
          </ul>
        </section>
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

      {deposits.length > 0 && (
        <section className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Deposito</h2>
            <span className="text-sm tabular-nums text-muted">Total {formatRupiah(depositTotal)}</span>
          </div>
          <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_1.4fr] gap-3 text-xs font-medium uppercase tracking-wide text-muted sm:grid">
            <span>Nama</span>
            <span className="text-right">Nominal</span>
            <span className="text-right">Bunga</span>
            <span className="text-right">Jatuh tempo</span>
          </div>
          <ul className="divide-y divide-border">
            {deposits.map((d) => {
              const days = d.maturityOn ? daysBetween(today, d.maturityOn) : null;
              const tone = days === null ? "text-muted" : days < 0 ? "text-red-600" : days <= 7 ? "text-amber-600" : "";
              return (
                <li key={d.id} className="grid grid-cols-2 gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[1.4fr_1fr_0.8fr_1.4fr]">
                  <Link href={`/transactions?account=${d.id}`} className="truncate font-medium hover:underline">{d.name}</Link>
                  <span className="text-right tabular-nums">{formatMoney(book.balanceAt(d.id, asOf), d.currency)}</span>
                  <span className="text-xs text-muted sm:text-right sm:text-sm">
                    {d.interestRate !== null ? formatRate(d.interestRate) : "–"}
                  </span>
                  <span className={`text-right text-xs sm:text-sm ${tone}`}>
                    {d.maturityOn && days !== null
                      ? `${formatDateId(d.maturityOn)} · ${days > 0 ? `${days} hari lagi` : days === 0 ? "hari ini" : "lewat"}`
                      : "–"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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

function Stat({ label, value, tone, className = "" }: { label: string; value: string; tone?: string; className?: string }) {
  return (
    <div className={`card ${className}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

type Acc = { id: number; name: string; type: string; currency: Currency; risk?: string | null };
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
                  {a.type === "investment" && ` · ${riskLabel(a.risk as Risk | null)}`}
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
