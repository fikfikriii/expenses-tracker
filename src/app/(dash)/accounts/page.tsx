import { AccountForm } from "@/components/entity-forms";
import { accountTypeLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { accountBalances, listAllAccounts } from "@/lib/ledger";

export default async function AccountsPage() {
  const [accounts, balances] = await Promise.all([listAllAccounts(), accountBalances()]);
  return (
    <>
      <h1 className="text-xl font-semibold">Akun</h1>
      <p className="-mt-4 text-sm text-muted">
        Dompet, rekening, e-wallet, tabungan, atau kartu. Alias dipakai bot buat ngenalin akun,
        misal &quot;50rb bensin pake <b>bca</b>&quot;. Akun default dipakai kalau chat nggak nyebut akun.
      </p>

      <section className="flex flex-col gap-3">
        {accounts.map((a) => {
          const bal = balances.get(a.id) ?? 0;
          return (
            <details key={a.id} className={`card ${a.archived ? "opacity-60" : ""}`}>
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="font-medium">
                  {a.name}
                  <span className="ml-2 text-xs font-normal text-muted">
                    {accountTypeLabel(a.type)}
                    {a.currency !== "IDR" && ` · ${a.currency}`}
                    {a.isDefault && " · default"}
                    {a.archived && " · diarsipkan"}
                  </span>
                </span>
                <span className={`tabular-nums ${bal < 0 ? "text-red-600" : ""}`}>
                  {formatMoney(bal, a.currency)}
                </span>
              </summary>
              <div className="mt-4">
                <AccountForm account={a} />
              </div>
            </details>
          );
        })}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-medium">➕ Tambah akun</h2>
        <AccountForm />
      </section>
    </>
  );
}
