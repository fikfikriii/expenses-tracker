import Link from "next/link";
import { TxForm } from "@/components/tx-form";
import { TxList } from "@/components/tx-list";
import { formatRupiah, todayJakarta } from "@/lib/dates";
import { listAllAccounts, listAllCategories, listTransactions, type TxFilters } from "@/lib/ledger";

const PAGE_SIZE = 50;

type Params = {
  from?: string; to?: string; type?: string; category?: string; account?: string; q?: string; page?: string;
};

function parseFilters(p: Params): TxFilters {
  const date = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const id = (s?: string) => (s && /^\d+$/.test(s) ? Number(s) : undefined);
  return {
    from: date(p.from),
    to: date(p.to),
    type: ["expense", "income", "transfer"].includes(p.type ?? "") ? (p.type as TxFilters["type"]) : undefined,
    categoryId: id(p.category),
    accountId: id(p.account),
    q: p.q?.trim() || undefined,
  };
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows, total }, accounts, categories] = await Promise.all([
    listTransactions(filters, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    listAllAccounts(),
    listAllCategories(),
  ]);
  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCategories = categories.filter((c) => !c.archived);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageSum = rows.reduce(
    (s, t) => ({
      income: s.income + (t.type === "income" ? t.amount : 0),
      expense: s.expense + (t.type === "expense" ? t.amount : 0),
    }),
    { income: 0, expense: 0 },
  );

  const qs = (patch: Partial<Params>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) u.set(k, String(v));
    return `/transactions?${u}`;
  };
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <h1 className="text-xl font-semibold">Transaksi</h1>

      <details className="card" open={rows.length === 0 && !hasFilters}>
        <summary className="cursor-pointer font-medium">➕ Tambah transaksi</summary>
        <div className="mt-4">
          <TxForm
            initial={{ type: "expense", occurredOn: todayJakarta(), accountId: activeAccounts[0]?.id }}
            accounts={activeAccounts}
            categories={activeCategories}
          />
        </div>
      </details>

      <form className="card grid grid-cols-2 gap-3 md:grid-cols-6" method="get">
        <label className="label">
          Dari
          <input type="date" name="from" defaultValue={filters.from} className="input" />
        </label>
        <label className="label">
          Sampai
          <input type="date" name="to" defaultValue={filters.to} className="input" />
        </label>
        <label className="label">
          Tipe
          <select name="type" defaultValue={filters.type ?? ""} className="input">
            <option value="">Semua</option>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
            <option value="transfer">Transfer</option>
          </select>
        </label>
        <label className="label">
          Kategori
          <select name="category" defaultValue={filters.categoryId ?? ""} className="input">
            <option value="">Semua</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.icon} ${c.name}`.trim()}{c.kind === "income" ? " (masuk)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Akun
          <select name="account" defaultValue={filters.accountId ?? ""} className="input">
            <option value="">Semua</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="label">
          Cari catatan
          <input name="q" defaultValue={filters.q} placeholder="bubur" className="input" />
        </label>
        <div className="col-span-2 flex gap-2 md:col-span-6">
          <button className="btn-primary">Terapkan</button>
          {hasFilters && <Link href="/transactions" className="btn">Reset</Link>}
        </div>
      </form>

      <section className="card flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted">{total} transaksi</span>
          <span className="tabular-nums text-muted">
            Di halaman ini: <span className="text-green-600">+{formatRupiah(pageSum.income)}</span> ·{" "}
            −{formatRupiah(pageSum.expense)}
          </span>
        </div>
        <TxList rows={rows} accounts={accounts} categories={categories} />
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2 text-sm">
            {page > 1 && <Link className="btn" href={qs({ page: String(page - 1) })}>←</Link>}
            <span className="text-muted">Hal {page} / {pages}</span>
            {page < pages && <Link className="btn" href={qs({ page: String(page + 1) })}>→</Link>}
          </div>
        )}
      </section>
    </>
  );
}
