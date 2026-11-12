"use client";

import { useActionState } from "react";
import { saveBalances, type FormState } from "@/app/(dash)/actions";

export function BalanceForm({ date, accounts }: {
  date: string;
  accounts: { id: number; name: string; typeLabel: string; current: string; group: string; currency: "IDR" | "USD" }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBalances, null);
  const groups = [...new Set(accounts.map((a) => a.group))];
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="label max-w-48">
        Tanggal cek
        <input type="date" name="takenOn" defaultValue={date} max={date} required className="input" />
      </label>
      {groups.map((g) => (
        <div key={g} className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{g}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.filter((a) => a.group === g).map((a) => (
              <label key={a.id} className="label">
                <span>
                  {a.name} <span className="font-normal">· {a.typeLabel}{a.currency === "USD" ? " · USD" : ""}</span>
                </span>
                <input
                  name={`bal_${a.id}`}
                  inputMode="decimal"
                  placeholder={`sekarang ${a.current}`}
                  className="input"
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted">Kosongin akun yang nggak mau di-update. Nominal bisa ditulis 5200000, 5,2jt, atau 800rb. Akun USD diisi dolar, misal 1250.50.</p>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Menyimpan..." : "Simpan saldo"}</button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-600">Saldo tersimpan ✓</p>}
      </div>
    </form>
  );
}
