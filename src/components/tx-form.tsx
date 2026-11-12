"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveTransaction, type FormState } from "@/app/(dash)/actions";

type Option = { id: number; name: string; icon?: string; kind?: "expense" | "income" };

export type TxFormValues = {
  id?: number;
  type: "expense" | "income" | "transfer";
  amount?: number;
  occurredOn: string;
  accountId?: number;
  toAccountId?: number | null;
  categoryId?: number | null;
  note?: string;
};

const TYPES = [
  { value: "expense", label: "💸 Pengeluaran" },
  { value: "income", label: "💰 Pemasukan" },
  { value: "transfer", label: "🔁 Transfer" },
] as const;

export function TxForm({
  initial,
  accounts,
  categories,
  returnTo,
}: {
  initial: TxFormValues;
  accounts: Option[];
  categories: Option[];
  returnTo?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTransaction, null);
  const [type, setType] = useState(initial.type);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && !initial.id) formRef.current?.reset();
  }, [state, initial.id]);

  const cats = categories.filter((c) => c.kind === (type === "income" ? "income" : "expense"));

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="flex gap-1 sm:col-span-2">
        {TYPES.map((t) => (
          <label
            key={t.value}
            className={`btn flex-1 cursor-pointer ${type === t.value ? "border-neutral-900 dark:border-neutral-100" : ""}`}
          >
            <input
              type="radio"
              name="type"
              value={t.value}
              checked={type === t.value}
              onChange={() => setType(t.value)}
              className="sr-only"
            />
            {t.label}
          </label>
        ))}
      </div>

      <label className="label">
        Nominal
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="15000 / 15rb / 1,5jt"
          defaultValue={initial.amount ?? ""}
          className="input"
        />
      </label>
      <label className="label">
        Tanggal
        <input type="date" name="occurredOn" required defaultValue={initial.occurredOn} className="input" />
      </label>

      <label className="label">
        {type === "transfer" ? "Dari akun" : "Akun"}
        <select name="accountId" defaultValue={initial.accountId} className="input">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>

      {type === "transfer" ? (
        <label className="label">
          Ke akun
          <select
            name="toAccountId"
            defaultValue={initial.toAccountId ?? accounts.find((a) => a.id !== initial.accountId)?.id}
            className="input"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="label">
          Kategori
          <select
            key={type}
            name="categoryId"
            defaultValue={cats.some((c) => c.id === initial.categoryId) ? initial.categoryId! : cats[0]?.id}
            className="input"
          >
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{`${c.icon ?? ""} ${c.name}`.trim()}</option>
            ))}
          </select>
        </label>
      )}

      <label className="label sm:col-span-2">
        Catatan
        <input name="note" defaultValue={initial.note ?? ""} placeholder="Makan bubur" className="input" />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : initial.id ? "Simpan perubahan" : "Tambah transaksi"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && !initial.id && <p className="text-sm text-green-600">Tersimpan ✓</p>}
      </div>
    </form>
  );
}
