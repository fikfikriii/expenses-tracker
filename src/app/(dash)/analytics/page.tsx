import Link from "next/link";
import { DataTable, Legend, MonthBars, VIZ, VIZ_OTHER, compact } from "@/components/charts";
import { formatMonthId, formatRupiah, monthRange, todayJakarta } from "@/lib/dates";
import { monthlyBreakdown } from "@/lib/ledger";

const RANGES = [3, 6, 12];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const n = RANGES.includes(Number(rangeParam)) ? Number(rangeParam) : 6;
  const thisMonth = todayJakarta().slice(0, 7);
  const months = Array.from({ length: n }, (_, i) => shiftMonth(thisMonth, i - (n - 1)));
  const rows = await monthlyBreakdown(`${months[0]}-01`, monthRange(`${thisMonth}-01`).end);

  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((s, r) => s + r.total, 0);
  const flow = months.map((m) => [sum((r) => r.month === m && r.type === "income"), sum((r) => r.month === m && r.type === "expense")]);

  // Top 5 expense categories over the whole range (fixed order by total), the rest folds into "Lainnya".
  const catTotals = new Map<string, number>();
  for (const r of rows) if (r.type === "expense") catTotals.set(r.category, (catTotals.get(r.category) ?? 0) + r.total);
  const ranked = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const top = ranked.slice(0, 5);
  const catSeries = [
    ...top.map((name, i) => ({ name, color: VIZ[i] })),
    ...(ranked.length > 5 ? [{ name: "Lainnya", color: VIZ_OTHER }] : []),
  ];
  const catValues = months.map((m) =>
    catSeries.map((s) =>
      sum((r) => r.month === m && r.type === "expense" && (s.name === "Lainnya" ? !top.includes(r.category) : r.category === s.name)),
    ),
  );

  const accTotals = new Map<string, number>();
  for (const r of rows) if (r.type === "expense") accTotals.set(r.account, (accTotals.get(r.account) ?? 0) + r.total);
  const accList = [...accTotals.entries()].sort((a, b) => b[1] - a[1]);
  const accSum = accList.reduce((s, [, v]) => s + v, 0);

  const flowSeries = [{ name: "Pemasukan", color: VIZ[0] }, { name: "Pengeluaran", color: VIZ[1] }];
  const totalIncome = flow.reduce((s, f) => s + f[0], 0);
  const totalExpense = flow.reduce((s, f) => s + f[1], 0);
  const empty = rows.length === 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Analitik</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Link key={r} href={`/analytics?range=${r}`} className={r === n ? "btn-primary" : "btn"}>{r} bln</Link>
          ))}
        </div>
      </div>

      {empty ? (
        <p className="card py-10 text-center text-sm text-muted">Belum ada transaksi di rentang ini.</p>
      ) : (
        <>
          <section className="card flex flex-col gap-3">
            <div>
              <h2 className="font-medium">Pemasukan vs pengeluaran</h2>
              <p className="text-xs text-muted">
                Total {n} bulan: masuk {formatRupiah(totalIncome)}, keluar {formatRupiah(totalExpense)}, arus kas{" "}
                {totalIncome - totalExpense < 0 ? "−" : "+"}{formatRupiah(Math.abs(totalIncome - totalExpense))}. Transfer nggak dihitung.
              </p>
            </div>
            <Legend series={flowSeries} />
            <MonthBars months={months} series={flowSeries} values={flow} />
            <DataTable
              head={["Bulan", "Masuk", "Keluar", "Arus kas"]}
              rows={months.map((m, i) => [
                formatMonthId(`${m}-01`), formatRupiah(flow[i][0]), formatRupiah(flow[i][1]), formatRupiah(flow[i][0] - flow[i][1]),
              ])}
            />
          </section>

          <section className="card flex flex-col gap-3">
            <div>
              <h2 className="font-medium">Pengeluaran per kategori</h2>
              <p className="text-xs text-muted">5 kategori terbesar, sisanya digabung. Bagus buat lihat kategori yang makin naik.</p>
            </div>
            {catSeries.length > 0 ? (
              <>
                <Legend series={catSeries} />
                <MonthBars months={months} series={catSeries} values={catValues} stacked />
                <DataTable
                  head={["Bulan", ...catSeries.map((s) => s.name), "Total"]}
                  rows={months.map((m, i) => [
                    formatMonthId(`${m}-01`),
                    ...catValues[i].map((v) => formatRupiah(v)),
                    formatRupiah(catValues[i].reduce((a, b) => a + b, 0)),
                  ])}
                />
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted">Belum ada pengeluaran.</p>
            )}
          </section>

          <section className="card flex flex-col gap-3">
            <div>
              <h2 className="font-medium">Pengeluaran per akun</h2>
              <p className="text-xs text-muted">Akun mana yang paling sering dipakai buat bayar, {n} bulan terakhir.</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {accList.map(([name, v]) => (
                <li key={name} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{name}</span>
                    <span className="tabular-nums">
                      {formatRupiah(v)} <span className="text-xs text-muted">{Math.round((v / Math.max(1, accSum)) * 100)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10" title={`${name}: ${formatRupiah(v)} (${compact(v)})`}>
                    <div className="h-1.5 rounded-full" style={{ width: `${(v / (accList[0]?.[1] || 1)) * 100}%`, background: VIZ[0] }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <p className="text-xs text-muted">Grafik kekayaan per bulan ada di <Link href="/" className="underline">Overview</Link>.</p>
    </>
  );
}
