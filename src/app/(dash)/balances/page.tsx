import { requireUser } from "@/lib/session";
import { BalanceForm } from "@/components/balance-form";
import { formatDateId, formatMonthId, formatRupiah, todayJakarta } from "@/lib/dates";
import { isInvestment } from "@/lib/balances";
import { accountTypeLabel } from "@/lib/labels";
import { listAllAccounts, listSnapshots, loadBalanceBook } from "@/lib/ledger";
import { isOwner } from "@/lib/users";
import { removeFxRate, removeSnapshot } from "../actions";
import { formatMoney } from "@/lib/money";
import { listRates } from "@/lib/fx";
import { FxRateForm } from "@/components/fx-form";

const signed = (n: number) => `${n < 0 ? "−" : "+"}${formatRupiah(Math.abs(n))}`;

export default async function BalancesPage() {
  const user = await requireUser();
  const today = todayJakarta();
  const [book, accounts, snapshots] = await Promise.all([
    loadBalanceBook(user.id),
    listAllAccounts(user.id),
    listSnapshots(user.id),
  ]);
  const rates = await listRates();
  const canEditRates = user.telegramId !== null && isOwner(user.telegramId);
  const active = accounts.filter((a) => !a.archived);
  const name = new Map(accounts.map((a) => [a.id, a.name]));
  const cur = (id: number) => accounts.find((a) => a.id === id)?.currency ?? "IDR";
  const hasUsd = accounts.some((a) => a.currency === "USD");

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
            current: formatMoney(book.balanceAt(a.id, today), a.currency),
            currency: a.currency,
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
                    <span key={i}>
                      {name.get(p.accountId)}: {p.diff === 0 ? "pas" : `${p.diff < 0 ? "−" : "+"}${formatMoney(Math.abs(p.diff), cur(p.accountId))}`}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasUsd && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-medium">Kurs USD → IDR</h2>
          <p className="text-sm text-muted">
            Diambil otomatis tiap hari (kurs referensi ECB) dan berlaku buat semua user.
            {canEditRates
              ? " Isi manual kalau mau pakai kurs lain; kurs manual nggak bakal ditimpa."
              : " Cuma owner yang bisa ngubah kurs."}{" "}
            Dipakai buat ngitung total kekayaan dan laporan dalam rupiah.
          </p>
          {canEditRates && <FxRateForm date={today} />}
          {rates.length > 0 && (
            <ul className="divide-y divide-border">
              {rates.slice(0, 10).map((r) => (
                <li key={r.rateOn} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted">{formatDateId(r.rateOn)}</span>
                  <span className="flex-1 tabular-nums">{formatRupiah(r.usdIdr)}</span>
                  <span className="text-xs text-muted">{r.source === "manual" ? "manual" : "otomatis"}</span>
                  {canEditRates && (
                    <form action={removeFxRate}>
                      <input type="hidden" name="rateOn" value={r.rateOn} />
                      <button className="text-xs text-muted hover:text-red-600" title="Hapus">✕</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                <span className="tabular-nums">{formatMoney(s.balance, cur(s.accountId))}</span>
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
