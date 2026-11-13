import { BudgetBar } from "@/components/budget-bar";
import { BudgetForm } from "@/components/budget-form";
import { formatMonthId, monthRange, todayJakarta } from "@/lib/dates";
import { listAllCategories, listBudgets, summarize } from "@/lib/ledger";

export default async function BudgetsPage() {
  const month = todayJakarta().slice(0, 7);
  const { start, end } = monthRange(`${month}-01`);
  const [cats, budgets, summary] = await Promise.all([listAllCategories(), listBudgets(), summarize(start, end)]);
  const limitOf = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimit]));
  const spentOf = new Map(summary.byCategory.filter((c) => c.kind === "expense").map((c) => [c.name, c.total]));
  const rows = cats.filter((c) => c.kind === "expense" && (!c.archived || limitOf.has(c.id)));
  const totalLimit = rows.reduce((s, c) => s + (limitOf.get(c.id) ?? 0), 0);
  const totalSpent = rows.filter((c) => limitOf.has(c.id)).reduce((s, c) => s + (spentOf.get(c.name) ?? 0), 0);

  return (
    <>
      <h1 className="text-xl font-semibold">Budget</h1>
      <p className="-mt-4 text-sm text-muted">
        Batas pengeluaran per kategori, berlaku tiap bulan. Kosongin kolomnya buat hapus budget. Bot ngasih
        peringatan pas udah 80% dan 100%. Progress di bawah buat {formatMonthId(`${month}-01`)}.
      </p>
      {totalLimit > 0 && (
        <section className="card flex flex-col gap-2">
          <h2 className="font-medium">Total yang dibudget</h2>
          <BudgetBar spent={totalSpent} limit={totalLimit} />
        </section>
      )}
      <section className="card flex flex-col divide-y divide-border">
        {rows.map((c) => {
          const limit = limitOf.get(c.id) ?? null;
          return (
            <div key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-sm">{`${c.icon} ${c.name}`.trim()}</div>
                {limit ? (
                  <BudgetBar spent={spentOf.get(c.name) ?? 0} limit={limit} />
                ) : (
                  <div className="text-xs text-muted">Belum ada budget · terpakai {(spentOf.get(c.name) ?? 0).toLocaleString("id-ID")}</div>
                )}
              </div>
              <BudgetForm categoryId={c.id} limit={limit} />
            </div>
          );
        })}
      </section>
    </>
  );
}
