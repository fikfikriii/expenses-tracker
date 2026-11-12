"use client";

import { useActionState } from "react";
import { saveFxRate, type FormState } from "@/app/(dash)/actions";

export function FxRateForm({ date }: { date: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveFxRate, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="label">
        Tanggal
        <input type="date" name="rateOn" defaultValue={date} required className="input" />
      </label>
      <label className="label">
        1 USD = Rp
        <input name="usdIdr" inputMode="decimal" required placeholder="16300" className="input w-32" />
      </label>
      <button className="btn" disabled={pending}>{pending ? "..." : "Simpan kurs"}</button>
      {state?.error && <p className="basis-full text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="basis-full text-sm text-green-600">Kurs tersimpan ✓</p>}
    </form>
  );
}
