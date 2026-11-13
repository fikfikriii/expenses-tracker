import { formatMonthId, formatRupiah } from "@/lib/dates";

export const VIZ = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)"];
export const VIZ_OTHER = "var(--viz-other)";

export function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1).replace(".0", "")}M`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace(".0", "")}jt`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}rb`;
  return `${sign}${abs}`;
}

export type Series = { name: string; color: string };

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

const W = 640;
const H = 220;
const PAD = { l: 44, r: 8, t: 10, b: 24 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/**
 * Bars per month. `grouped` puts the series side by side, otherwise they stack.
 * Hovering a bar shows its value through the native SVG tooltip.
 */
export function MonthBars({ months, series, values, stacked }: {
  months: string[];
  series: Series[];
  values: number[][]; // values[month][series]
  stacked?: boolean;
}) {
  const totals = values.map((v) => (stacked ? v.reduce((a, b) => a + b, 0) : Math.max(...v, 0)));
  const max = niceMax(Math.max(...totals, 0));
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const slot = plotW / Math.max(1, months.length);
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const groupW = Math.min(48, slot * 0.7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik per bulan">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{compact(t)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        const label = formatMonthId(`${m}-01`).slice(0, 3);
        let acc = 0;
        const barW = stacked ? groupW : groupW / series.length - 2;
        return (
          <g key={m}>
            {series.map((s, j) => {
              const v = values[i][j];
              if (v <= 0) return null;
              const h = Math.max(1, (v / max) * plotH);
              const x = stacked ? cx - groupW / 2 : cx - groupW / 2 + j * (barW + 2);
              const top = stacked ? y(acc + v) : y(v);
              const rect = (
                <rect key={s.name} x={x} y={top} width={barW} height={stacked ? Math.max(1, h - 2) : h} rx={3} fill={s.color}>
                  <title>{`${formatMonthId(`${m}-01`)} · ${s.name}: ${formatRupiah(v)}`}</title>
                </rect>
              );
              acc += v;
              return rect;
            })}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Table twin of a chart, for reading exact values. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-muted">Lihat sebagai tabel</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-left text-muted">
              {head.map((h, i) => <th key={h} className={`py-1 pr-3 font-medium ${i ? "text-right" : ""}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((c, j) => <td key={j} className={`py-1 pr-3 ${j ? "text-right" : ""}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
