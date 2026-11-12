"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAccount, saveCategory, type FormState } from "@/app/(dash)/actions";
import { ACCOUNT_TYPES } from "@/lib/labels";


function Status({ state, isNew }: { state: FormState; isNew: boolean }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-600">{isNew ? "Ditambahkan ✓" : "Tersimpan ✓"}</p>;
  return null;
}

function useResetOnSuccess(state: FormState, isNew: boolean) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && isNew) ref.current?.reset();
  }, [state, isNew]);
  return ref;
}

export function AccountForm({ account }: {
  account?: {
    id: number; name: string; type: string; aliases: string[];
    initialBalance: number; isDefault: boolean; archived: boolean;
  };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAccount, null);
  const ref = useResetOnSuccess(state, !account);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      {account && <input type="hidden" name="id" value={account.id} />}
      <label className="label">
        Nama
        <input name="name" required defaultValue={account?.name} placeholder="BCA" className="input" />
      </label>
      <label className="label">
        Tipe
        <select name="type" defaultValue={account?.type ?? "bank"} className="input">
          {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label className="label">
        Saldo awal
        <input
          name="initialBalance"
          inputMode="decimal"
          defaultValue={account?.initialBalance ?? ""}
          placeholder="0 / 1,5jt"
          className="input"
        />
      </label>
      <label className="label">
        Alias buat bot (pisah koma)
        <input
          name="aliases"
          defaultValue={account?.aliases.join(", ")}
          placeholder="bca, mbca"
          className="input"
        />
      </label>
      <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isDefault" defaultChecked={account?.isDefault} /> Akun default
        </label>
        {account && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="archived" defaultChecked={account.archived} /> Arsipkan
          </label>
        )}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Menyimpan..." : account ? "Simpan" : "Tambah akun"}
        </button>
        <Status state={state} isNew={!account} />
      </div>
    </form>
  );
}

export function CategoryForm({ category, kind }: {
  category?: { id: number; name: string; icon: string; keywords: string[]; archived: boolean };
  kind?: "expense" | "income";
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCategory, null);
  const ref = useResetOnSuccess(state, !category);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      {category && <input type="hidden" name="id" value={category.id} />}
      {!category && <input type="hidden" name="kind" value={kind} />}
      <label className="label w-16">
        Ikon
        <input name="icon" defaultValue={category?.icon} placeholder="🍜" className="input text-center" />
      </label>
      <label className="label min-w-40 flex-1">
        Nama
        <input name="name" required defaultValue={category?.name} placeholder="Nama kategori" className="input" />
      </label>
      <label className="label min-w-48 flex-[2]">
        Kata kunci (pisah koma)
        <input
          name="keywords"
          defaultValue={category?.keywords.join(", ")}
          placeholder={category ? "opsional" : "latte, starbucks"}
          className="input"
        />
      </label>
      {category && (
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="archived" defaultChecked={category.archived} /> Arsip
        </label>
      )}
      <button className={category ? "btn" : "btn-primary"} disabled={pending}>
        {pending ? "..." : category ? "Simpan" : "Tambah"}
      </button>
      <div className="basis-full"><Status state={state} isNew={!category} /></div>
    </form>
  );
}
