import { BalanceForm } from "@/components/balance-form";
import { formatDateId, formatMonthId, formatRupiah, todayJakarta } from "@/lib/dates";
import { isInvestment } from "@/lib/balances";
import { accountTypeLabel } from "@/lib/labels";
import { listAllAccounts, listSnapshots, loadBalanceBook } from "@/lib/ledger";
import { removeSnapshot } from "../actions";

const signed = (n: number) => `${n < 0 ? "−" : "+"}${formatRupiah(Math.abs(n))}`;

export default async function BalancesPage() {
  const today = todayJakarta();
  const [book, accounts, snapshots] = await Promise.all([loadBalanceBook(), listAllAccounts(), listSnapshots()]);
  const active = accounts.filter((a) => !a.archived);
  const name = new Map(accounts.map((a) => [a.id, a.name]));

  // Unrecorded money per month, newest first.
  const byMonth = new Map<string, { diff: number; parts: { accountId: number; diff: number }[] }>();
  for (const u of book.unrecorded()) {
    const m = u.takenOn.slice(0, 7);
    const e = byMonth.get(m) ?? { diff: 0, parts: [] };
    e.diff += u.diff;
    e.parts.push({ accountId: u.accountId, diff: u.diff });
    byMonth.set(m, e);
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <h1 className="text-xl font-semibold">Saldo</h1>
      <p className="-mt-4 text-sm text-muted">
        Cek saldo asli tiap akun (biasanya akhir bulan) dan catat di sini, atau kirim ke bot:{" "}
        <code>saldo bca 5,2jt mandiri 3jt</code>. Saldo di dashboard = cek saldo terakhir + transaksi yang
        dicatat sesudahnya, jadi transfer antar akun nggak perlu dicatat.
      </p>

      <section className="card">
        <BalanceForm
          date={today}
          accounts={active.map((a) => ({
            id: a.id,
            name: a.name,
            typeLabel: accountTypeLabel(a.type),
            current: formatRupiah(book.balanceAt(a.id, today)),
            group: isInvestment(a) ? "Investasi" : "Kas & bank",
          }))}
        />
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-medium">Selisih tak tercatat</h2>
        <p className="text-sm text-muted">
          Saldo asli dikurangi perkiraan (cek sebelumnya + transaksi tercatat). Transfer antar akun saling
          nutup, jadi sisanya: <b>plus</b> = bunga, cashback, pemasukan yang belum dicatat; <b>minus</b> =
          pengeluaran yang belum dicatat. Investasi nggak dihitung karena nilainya ikut pasar.
        </p>
        {months.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            Muncul setelah lu cek saldo minimal dua kali (misal akhir bulan ini dan akhir bulan depan).
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {months.map(([m, e]) => (
              <li key={m} className="flex flex-col gap-1 py-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>{formatMonthId(`${m}-01`)}</span>
                  <span className={`tabular-nums ${e.diff < 0 ? "text-red-600" : e.diff > 0 ? "text-green-600" : ""}`}>
                    {e.diff === 0 ? "Rp0 ✓" : signed(e.diff)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 text-xs text-muted">
                  {e.parts.map((p, i) => (
                    <span key={i}>{name.get(p.accountId)}: {p.diff === 0 ? "pas" : signed(p.diff)}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-medium">Riwayat cek saldo</h2>
        {snapshots.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Belum pernah cek saldo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {snapshots.slice(0, 60).map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted">{formatDateId(s.takenOn)}</span>
                <span className="flex-1">{name.get(s.accountId)}</span>
                <span className="tabular-nums">{formatRupiah(s.balance)}</span>
                <form action={removeSnapshot}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="text-xs text-muted hover:text-red-600" title="Hapus">✕</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
