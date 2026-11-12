import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { todayJakarta } from "./dates";

const { fxRates } = schema;

export type Rate = { rateOn: string; usdIdr: number; source: string };

/** Rate for a day: the latest one on or before it, else the earliest known. */
export function rateFrom(rates: Rate[], date: string): number | null {
  if (rates.length === 0) return null;
  const sorted = [...rates].sort((a, b) => a.rateOn.localeCompare(b.rateOn));
  let pick = sorted[0];
  for (const r of sorted) if (r.rateOn <= date) pick = r;
  return pick.usdIdr;
}

export async function listRates(): Promise<Rate[]> {
  return db().select().from(fxRates).orderBy(desc(fxRates.rateOn));
}

export async function saveRate(rateOn: string, usdIdr: number, source: "auto" | "manual") {
  const q = db().insert(fxRates).values({ rateOn, usdIdr, source });
  if (source === "manual") {
    await q.onConflictDoUpdate({
      target: fxRates.rateOn,
      set: { usdIdr, source, createdAt: sql`now()` },
    });
  } else {
    // Never overwrite a rate typed in by hand.
    await q.onConflictDoNothing();
  }
}

export async function deleteRate(rateOn: string) {
  await db().delete(fxRates).where(eq(fxRates.rateOn, rateOn));
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Today's USD -> IDR rate from free public sources (no API key). */
export async function fetchUsdIdr(): Promise<number | null> {
  const sources: [string, (j: unknown) => number | undefined][] = [
    // European Central Bank reference rates.
    ["https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR", (j) => (j as { rates?: { IDR?: number } }).rates?.IDR],
    ["https://api.frankfurter.app/latest?from=USD&to=IDR", (j) => (j as { rates?: { IDR?: number } }).rates?.IDR],
    ["https://open.er-api.com/v6/latest/USD", (j) => (j as { rates?: { IDR?: number } }).rates?.IDR],
  ];
  for (const [url, pick] of sources) {
    try {
      const rate = pick(await fetchJson(url));
      if (typeof rate === "number" && rate > 1000) return rate;
    } catch (err) {
      console.error("FX fetch failed", url, err);
    }
  }
  return null;
}

let lastAttempt = 0;

/** Makes sure today's rate is stored (fetches it once a day). Safe to call often. */
export async function ensureTodayRate(): Promise<void> {
  const today = todayJakarta();
  const [row] = await db().select().from(fxRates).where(eq(fxRates.rateOn, today));
  if (row) return;
  // Don't retry a failing source on every request.
  if (Date.now() - lastAttempt < 30 * 60 * 1000) return;
  lastAttempt = Date.now();
  const rate = await fetchUsdIdr();
  if (rate) await saveRate(today, rate, "auto");
}

/** Today's rate (fetched if needed), or the latest known one. */
export async function currentRate(): Promise<number | null> {
  await ensureTodayRate().catch(() => {});
  return rateFrom(await listRates(), todayJakarta());
}
