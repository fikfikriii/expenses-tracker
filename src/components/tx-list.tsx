import Link from "next/link";
import { formatDateId, formatRupiah } from "@/lib/dates";
import type { Account, Category, Transaction } from "@/db/schema";

export function TxList({ rows, accounts, categories }: {
  rows: Transaction[];
  accounts: Account[];
  categories: Category[];
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">Belum ada transaksi.</p>;
  const acc = new Map(accounts.map((a) => [a.id, a.name]));
  const cat = new Map(categories.map((c) => [c.id, c]));
  return (
    <ul className="divide-y divide-border">
      {rows.map((t) => {
        const c = t.categoryId ? cat.get(t.categoryId) : undefined;
        const title =
          t.type === "transfer"
            ? `${acc.get(t.accountId)} → ${acc.get(t.toAccountId ?? 0)}`
            : t.note || c?.name || "-";
        const sub =
          t.type === "transfer"
            ? "Transfer"
            : `${c ? `${c.icon} ${c.name}`.trim() : "Tanpa kategori"} · ${acc.get(t.accountId)}`;
        const amountClass =
          t.type === "income" ? "text-green-600" : t.type === "expense" ? "" : "text-muted";
        const sign = t.type === "income" ? "+" : t.type === "expense" ? "−" : "";
        return (
          <li key={t.id}>
            <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
              <div className="w-14 shrink-0 text-xs text-muted">{formatDateId(t.occurredOn)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{title}</div>
                <div className="truncate text-xs text-muted">{sub}</div>
              </div>
              <div className={`shrink-0 text-sm font-medium tabular-nums ${amountClass}`}>
                {sign}{formatRupiah(t.amount)}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
