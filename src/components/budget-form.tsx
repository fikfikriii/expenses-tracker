"use client";

import { useActionState } from "react";
import { saveBudget, type FormState } from "@/app/(dash)/actions";

export function BudgetForm({ categoryId, limit }: { categoryId: number; limit: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBudget, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input
        name="limit"
        inputMode="numeric"
        defaultValue={limit ?? ""}
        placeholder="1,5jt / 500rb"
        className="input w-32"
        aria-label="Batas per bulan"
      />
      <button className="btn" disabled={pending}>{pending ? "..." : "Simpan"}</button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-xs text-green-600">✓</span>}
    </form>
  );
}
