import { isInvestment } from "@/lib/balances";
import { requireUser } from "@/lib/session";
import { AccountForm } from "@/components/entity-forms";
import { accountTypeLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { riskLabel } from "@/lib/risk";
import { formatRate, maturityLabel } from "@/lib/maturity";
import { todayJakarta } from "@/lib/dates";
import { accountBalances, listAllAccounts } from "@/lib/ledger";

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, balances] = await Promise.all([listAllAccounts(user.id), accountBalances(user.id)]);
  return (
    <>
      <h1 className="text-xl font-semibold">Akun</h1>
      <p className="-mt-4 text-sm text-muted">
        Rekening bank (termasuk tunai dan e-wallet) dan akun investasi. Alias dipakai bot buat ngenalin akun,
        misal &quot;50rb bensin pake <b>bca</b>&quot;. Akun default dipakai kalau chat nggak nyebut akun.
      </p>

      {[
        { title: "Bank", list: accounts.filter((a) => !isInvestment(a)) },
        { title: "Investasi", list: accounts.filter((a) => isInvestment(a)) },
      ].map(({ title, list }) => list.length > 0 && (
        <section key={title} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted">{title}</h2>
          {list.map((a) => {
            const bal = balances.get(a.id) ?? 0;
            return (
              <details key={a.id} className={`card ${a.archived ? "opacity-60" : ""}`}>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="font-medium">
                    {a.name}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {accountTypeLabel(a.type)}
                      {a.currency !== "IDR" && ` · ${a.currency}`}
                      {(a.type === "investment" || a.type === "deposit") && ` · ${riskLabel(a.risk)}`}
                      {a.type === "deposit" && a.interestRate !== null && ` · ${formatRate(a.interestRate)}`}
                      {a.type === "deposit" && a.maturityOn && ` · ${maturityLabel(a.maturityOn, todayJakarta())}`}
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
      ))}

      <section className="card flex flex-col gap-3">
        <h2 className="font-medium">➕ Tambah akun</h2>
        <AccountForm />
      </section>
    </>
  );
}
