export const TIME_ZONE = "Asia/Jakarta";

/** Today's date in Jakarta as YYYY-MM-DD. */
export function todayJakarta(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function toIsoDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function monthRange(iso: string): { start: string; end: string } {
  const [y, m] = iso.split("-").map(Number);
  const start = toIsoDate(y, m, 1)!;
  const end = addDays(m === 12 ? toIsoDate(y + 1, 1, 1)! : toIsoDate(y, m + 1, 1)!, -1);
  return { start, end };
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "2026-11-05" -> "5 Nov 2026" (year dropped if it is the current year). */
export function formatDateId(iso: string, today = todayJakarta()): string {
  const [y, m, d] = iso.split("-").map(Number);
  const short = MONTHS_ID[m - 1].slice(0, 3);
  return y === Number(today.slice(0, 4)) ? `${d} ${short}` : `${d} ${short} ${y}`;
}

export function formatMonthId(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

export function formatRupiah(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
