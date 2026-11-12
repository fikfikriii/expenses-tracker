import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { TxForm } from "@/components/tx-form";
import { getTransaction, listAllAccounts, listAllCategories } from "@/lib/ledger";
import { removeTransaction } from "../../actions";

export default async function EditTransaction({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [tx, accounts, categories] = await Promise.all([
    getTransaction(Number(id)),
    listAllAccounts(),
    listAllCategories(),
  ]);
  if (!tx) notFound();

  // Keep archived items selectable if this transaction already uses them.
  const accs = accounts.filter((a) => !a.archived || a.id === tx.accountId || a.id === tx.toAccountId);
  const cats = categories.filter((c) => !c.archived || c.id === tx.categoryId);

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href="/transactions" className="btn">←</Link>
        <h1 className="text-xl font-semibold">Edit transaksi</h1>
      </div>
      <div className="card">
        <TxForm
          initial={{
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            occurredOn: tx.occurredOn,
            accountId: tx.accountId,
            toAccountId: tx.toAccountId,
            categoryId: tx.categoryId,
            note: tx.note,
          }}
          accounts={accs}
          categories={cats}
          returnTo="/transactions"
        />
      </div>
      {tx.rawText && (
        <p className="text-sm text-muted">
          Chat asli: <span className="font-mono">{tx.rawText}</span>
        </p>
      )}
      <form action={removeTransaction}>
        <input type="hidden" name="id" value={tx.id} />
        <ConfirmButton message="Hapus transaksi ini?" className="btn-danger">🗑️ Hapus transaksi</ConfirmButton>
      </form>
    </>
  );
}
