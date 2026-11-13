"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { removeRecurring, saveRecurring, type FormState } from "@/app/(dash)/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { toInputValue } from "@/lib/money";

type Acc = { id: number; name: string; currency: "IDR" | "USD" };
type Cat = { id: number; name: string; icon: string; kind: "expense" | "income" };
type Rule = {
  id: number; type: "expense" | "income"; amount: number; accountId: number;
  categoryId: number | null; note: string; dayOfMonth: number; active: boolean;
};

export function RecurringForm({ rule, accounts, categories }: { rule?: Rule; accounts: Acc[]; categories: Cat[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRecurring, null);
  const [type, setType] = useState<"expense" | "income">(rule?.type ?? "expense");
  const [accId, setAccId] = useState(rule?.accountId ?? accounts[0]?.id);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !rule) ref.current?.reset();
  }, [state, rule]);
  const cur = accounts.find((a) => a.id === accId)?.currency ?? "IDR";
  const cats = categories.filter((c) => c.kind === type);

  return (
    <div className="flex flex-col gap-2">
      <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-3">
        {rule && <input type="hidden" name="id" value={rule.id} />}
        <label className="label">
          Tipe
          <select name="type" value={type} onChange={(e) => setType(e.target.value as "expense" | "income")} className="input">
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
        </label>
        <label className="label">
          Nominal ({cur})
          <input
            name="amount"
            required
            inputMode="decimal"
            defaultValue={rule ? toInputValue(rule.amount, cur) : ""}
            placeholder="1,5jt / 500rb"
            className="input"
          />
        </label>
        <label className="label">
          Tiap tanggal
          <input name="dayOfMonth" type="number" min={1} max={31} required defaultValue={rule?.dayOfMonth} placeholder="1" className="input" />
        </label>
        <label className="label">
          Akun
          <select name="accountId" value={accId} onChange={(e) => setAccId(Number(e.target.value))} className="input">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="label">
          Kategori
          <select name="categoryId" key={type} defaultValue={rule?.type === type ? (rule.categoryId ?? "") : ""} className="input">
            <option value="" disabled>Pilih</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{`${c.icon} ${c.name}`.trim()}</option>)}
          </select>
        </label>
        <label className="label">
          Catatan
          <input name="note" defaultValue={rule?.note} placeholder="Kost, Netflix, cicilan..." className="input" />
        </label>
        <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-3">
          {rule && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={rule.active} /> Aktif
            </label>
          )}
          <button className={rule ? "btn" : "btn-primary"} disabled={pending}>
            {pending ? "Menyimpan..." : rule ? "Simpan" : "Tambah transaksi rutin"}
          </button>
          {state?.error && <span className="text-red-600">{state.error}</span>}
          {state?.ok && <span className="text-green-600">{rule ? "Tersimpan ✓" : "Ditambahkan ✓"}</span>}
        </div>
      </form>
      {rule && (
        <form action={removeRecurring}>
          <input type="hidden" name="id" value={rule.id} />
          <ConfirmButton message="Hapus transaksi rutin ini? Transaksi yang sudah tercatat tetap ada." className="text-xs text-red-600 hover:underline">
            Hapus
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
