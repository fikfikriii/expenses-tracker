import { daysBetween, formatDateId } from "./dates";

/** "jatuh tempo 12 Des 2026 · 23 hari lagi" for an account with a maturity date. */
export function maturityLabel(maturityOn: string, today: string): string {
  const days = daysBetween(today, maturityOn);
  const date = formatDateId(maturityOn, today);
  if (days > 0) return `jatuh tempo ${date} · ${days} hari lagi`;
  if (days === 0) return "jatuh tempo hari ini";
  return `sudah jatuh tempo (${date})`;
}

/** "6" / "6,5" / "6.25%" -> 6 / 6.5 / 6.25. Null when it is not a rate between 0 and 100. */
export function parseRate(raw: string): number | null {
  const n = Number(raw.replace("%", "").replace(",", ".").trim());
  return raw.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/** 6 -> "6% p.a.", 6.25 -> "6,25% p.a." */
export function formatRate(rate: number): string {
  return `${rate.toLocaleString("id-ID", { maximumFractionDigits: 2 })}% p.a.`;
}
