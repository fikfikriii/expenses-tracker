import { addDays, toIsoDate } from "./dates";
import { extractUsd } from "./money";

export type ParsedMessage = {
  /** Whole Rupiah, or null when no amount was found. */
  amount: number | null;
  /** A dollar amount ("$1000", "50 usd") in cents, or null. */
  usdCents: number | null;
  /** YYYY-MM-DD */
  date: string;
  /** True when the user wrote a date ("kemarin", "5 Nov"...). */
  dateExplicit: boolean;
  /** "+" when the amount was written as "+500rb" (a hint for income). */
  sign: "+" | "-" | null;
  /** The message with the amount and date removed. */
  rest: string;
};

const MONTHS: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, pebruari: 2, feb: 2, peb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, agt: 8, ags: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  oktober: 10, okt: 10, oct: 10,
  november: 11, nopember: 11, nov: 11, nop: 11,
  desember: 12, des: 12, dec: 12,
};

const MONTH_RE = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

type Span = { start: number; end: number };

function cut(text: string, span: Span): string {
  return text.slice(0, span.start) + " " + text.slice(span.end);
}

/** If a date has no year, use this year, or last year if it would be in the future. */
function withYear(m: number, d: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const iso = toIsoDate(year, m, d);
  if (iso && iso > today) return toIsoDate(year - 1, m, d);
  return iso;
}

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

export function extractDate(
  text: string,
  today: string,
): { date: string; explicit: boolean; text: string } {
  const prefix = String.raw`(?:(?:tanggal|tgl|tg)\.?\s*)?`;
  const rules: { re: RegExp; toDate: (m: RegExpMatchArray) => string | null }[] = [
    {
      // 2026-11-05
      re: new RegExp(String.raw`${prefix}\b(\d{4})-(\d{1,2})-(\d{1,2})\b`, "i"),
      toDate: (m) => toIsoDate(+m[1], +m[2], +m[3]),
    },
    {
      // 5 November 2026, 5 nov, 05 Nov 26
      re: new RegExp(String.raw`${prefix}\b(\d{1,2})\s*(${MONTH_RE})\.?(?:\s+(\d{4}|\d{2}))?\b`, "i"),
      toDate: (m) => {
        const month = MONTHS[m[2].toLowerCase()];
        return m[3] ? toIsoDate(normalizeYear(+m[3]), month, +m[1]) : withYear(month, +m[1], today);
      },
    },
    {
      // 5/11/2026, 5-11-26, 5/11
      re: new RegExp(String.raw`${prefix}\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?\b`, "i"),
      toDate: (m) =>
        m[3] ? toIsoDate(normalizeYear(+m[3]), +m[2], +m[1]) : withYear(+m[2], +m[1], today),
    },
    {
      re: /\b(?:kemarin|kemaren|kmrn|kmarin|kmren)\s+lusa\b/i,
      toDate: () => addDays(today, -2),
    },
    {
      re: /\b(?:kemarin|kemaren|kmrn|kmarin|kmren|kemarn)\b/i,
      toDate: () => addDays(today, -1),
    },
    {
      // 3 hari lalu, 3 hari yang lalu
      re: /\b(\d{1,3})\s*hari\s+(?:yang\s+|yg\s+)?(?:lalu|lalu|kemarin)\b/i,
      toDate: (m) => addDays(today, -Number(m[1])),
    },
    {
      re: /\bminggu\s+lalu\b/i,
      toDate: () => addDays(today, -7),
    },
    {
      re: /\b(?:hari\s+ini|hr\s+ini|tadi(?:\s+(?:pagi|siang|sore|malam|malem))?)\b/i,
      toDate: () => today,
    },
  ];

  for (const rule of rules) {
    const m = text.match(rule.re);
    if (!m || m.index === undefined) continue;
    const date = rule.toDate(m);
    if (!date) continue;
    return {
      date,
      explicit: true,
      text: cut(text, { start: m.index, end: m.index + m[0].length }),
    };
  }
  return { date: today, explicit: false, text };
}

const SUFFIX: Record<string, number> = {
  rb: 1_000,
  ribu: 1_000,
  rebu: 1_000,
  k: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
};

function parseNumber(raw: string, hasSuffix: boolean): number | null {
  if (hasSuffix) {
    // 1,5jt / 1.5jt -> 1.5
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const groups = raw.split(/[.,]/);
  if (groups.length > 1 && groups.slice(1).every((g) => g.length === 3)) {
    return Number(groups.join("")); // 15.000 / 1,500,000
  }
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function extractAmount(text: string): {
  amount: number | null;
  sign: "+" | "-" | null;
  text: string;
} {
  const re = /(^|[\s(])([+-])?\s*(rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|rebu|k|jt|juta)?(?=$|[\s,.;:!?)])/gi;
  type Candidate = { value: number; sign: "+" | "-" | null; strong: boolean; span: Span };
  const candidates: Candidate[] = [];
  for (const m of text.matchAll(re)) {
    const suffix = m[5]?.toLowerCase();
    const base = parseNumber(m[4], Boolean(suffix));
    if (base === null) continue;
    const value = Math.round(base * (suffix ? SUFFIX[suffix] : 1));
    if (value <= 0) continue;
    const start = (m.index ?? 0) + m[1].length;
    candidates.push({
      value,
      sign: (m[2] as "+" | "-" | undefined) ?? null,
      strong: Boolean(suffix || m[3]),
      span: { start, end: (m.index ?? 0) + m[0].length },
    });
  }
  if (candidates.length === 0) return { amount: null, sign: null, text };

  // Prefer amounts written with "rp" or a suffix, then the biggest number
  // ("2 bungkus nasi 30000" -> 30000).
  const best = [...candidates].sort(
    (a, b) => Number(b.strong) - Number(a.strong) || b.value - a.value,
  )[0];
  return { amount: best.value, sign: best.sign, text: cut(text, best.span) };
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:\-–]+|[\s,.;:\-–]+$/g, "")
    .trim();
}

export function parseMessage(text: string, today: string): ParsedMessage {
  const d = extractDate(text, today);
  const u = extractUsd(d.text);
  const a = extractAmount(u.text);
  return {
    amount: a.amount,
    usdCents: u.cents,
    date: d.date,
    dateExplicit: d.explicit,
    sign: a.sign,
    rest: tidy(a.text),
  };
}
