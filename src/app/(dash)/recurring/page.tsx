import { requireUser } from "@/lib/session";
import { RecurringForm } from "@/components/recurring-form";
import { formatMoney } from "@/lib/money";
import { listAllAccounts, listAllCategories } from "@/lib/ledger";
import { listRecurring } from "@/lib/recurring";

export default async function RecurringPage() {
  const user = await requireUser();
  const [rules, accounts, categories] = await Promise.all([
    listRecurring(user.id),
    listAllAccounts(user.id),
    listAllCategories(user.id),
  ]);
  const accs = accounts.filter((a) => !a.archived);
  const cats = categories.filter((c) => !c.archived);
  const cur = (id: number) => accounts.find((a) => a.id === id)?.currency ?? "IDR";

  return (
    <>
      <h1 className="text-xl font-semibold">Transaksi rutin</h1>
      <p className="-mt-4 text-sm text-muted">
        Buat yang berulang tiap bulan (kost, langganan, cicilan, gaji). Dicatat otomatis sekitar jam 7 malam di
        tanggalnya, dan bot ngabarin. Kalau tanggalnya 31 tapi bulannya cuma 30 hari, dicatat di hari terakhir.
        Kalau lu tambahin setelah tanggalnya lewat, mulainya bulan depan.
      </p>
      <section className="card flex flex-col gap-4">
        <h2 className="font-medium">Tambah baru</h2>
        <RecurringForm accounts={accs} categories={cats} />
      </section>
      {rules.length > 0 && (
        <section className="card flex flex-col divide-y divide-border">
          {rules.map((r) => (
            <div key={r.id} className={`flex flex-col gap-3 py-4 first:pt-0 last:pb-0 ${r.active ? "" : "opacity-60"}`}>
              <div className="text-sm text-muted">
                Tiap tanggal {r.dayOfMonth} · {formatMoney(r.amount, cur(r.accountId))}
                {r.type === "income" ? " masuk" : " keluar"}
                {r.note ? ` · ${r.note}` : ""}
              </div>
              <RecurringForm rule={{ ...r, type: r.type === "income" ? "income" : "expense" }} accounts={accounts} categories={cats} />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
