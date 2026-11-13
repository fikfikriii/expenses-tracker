import { formatRupiah } from "@/lib/dates";

/** Spent vs limit. Color shifts at 80% and 100%; the % text carries the state too. */
export function BudgetBar({ spent, limit }: { spent: number; limit: number }) {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const tone = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  const left = limit - spent;
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span className="tabular-nums">
          {formatRupiah(spent)} / {formatRupiah(limit)} · {Math.round(pct)}%
        </span>
        <span className="tabular-nums">
          {left >= 0 ? `sisa ${formatRupiah(left)}` : `lebih ${formatRupiah(-left)}`}
        </span>
      </div>
    </div>
  );
}
