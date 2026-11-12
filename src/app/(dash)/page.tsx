import Link from "next/link";
import { TxList } from "@/components/tx-list";
import { accountTypeLabel } from "@/lib/labels";
import { formatMonthId, formatRupiah, monthRange, todayJakarta } from "@/lib/dates";
import {
  accountBalances,
  listAllAccounts,
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

  const [summary, balances, accounts, categories, recent] = await Promise.all([
    summarize(start, end),
    accountBalances(),
    listAllAccounts(),
    listAllCategories(),
    recentTransactions(8),
  ]);

  const active = accounts.filter((a) => !a.archived);
  const totalBalance = active.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
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
        <Stat label="Total saldo" value={formatRupiah(totalBalance)} />
      </section>

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
          <ul className="divide-y divide-border">
            {active.map((a) => {
              const bal = balances.get(a.id) ?? 0;
              return (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/transactions?account=${a.id}`} className="hover:underline">
                    {a.name}
                    <span className="ml-2 text-xs text-muted">{accountTypeLabel(a.type)}</span>
                  </Link>
                  <span className={`tabular-nums ${bal < 0 ? "text-red-600" : ""}`}>
                    {bal < 0 ? "−" : ""}{formatRupiah(Math.abs(bal))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

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

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
