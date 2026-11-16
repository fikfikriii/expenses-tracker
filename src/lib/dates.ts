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

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/**
 * A "period" is a budget month that starts on `startDay` (1-28) instead of the 1st, for people paid
 * mid-month. It is named after the calendar month it ends in: with startDay 25, "2026-11" runs
 * 25 Oct - 24 Nov. startDay 1 is the plain calendar month.
 */
export const DEFAULT_START_DAY = 1;

/** The period ("YYYY-MM") that contains `iso`. */
export function periodKey(iso: string, startDay = DEFAULT_START_DAY): string {
  const month = iso.slice(0, 7);
  return startDay > 1 && Number(iso.slice(8, 10)) >= startDay ? shiftMonth(month, 1) : month;
}

/** First and last day of period `key` ("YYYY-MM"). */
export function periodRange(key: string, startDay = DEFAULT_START_DAY): { start: string; end: string } {
  if (startDay <= 1) return monthRange(`${key}-01`);
  const pad = String(startDay).padStart(2, "0");
  return { start: `${shiftMonth(key, -1)}-${pad}`, end: addDays(`${key}-${pad}`, -1) };
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
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}Rp${Math.abs(r).toLocaleString("id-ID")}`;
}

/** "November 2026", plus the day range when the period is not a calendar month. */
export function formatPeriodId(key: string, startDay = DEFAULT_START_DAY): string {
  const label = formatMonthId(`${key}-01`);
  if (startDay <= 1) return label;
  const { start, end } = periodRange(key, startDay);
  return `${label} (${formatDateId(start)} - ${formatDateId(end)})`;
}
