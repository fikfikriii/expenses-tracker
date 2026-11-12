// Money helpers. Amounts are integers in the currency's smallest unit:
// whole rupiah for IDR, cents for USD.

export type Currency = "IDR" | "USD";

export const MINOR_PER_UNIT: Record<Currency, number> = { IDR: 1, USD: 100 };

export function formatMoney(minor: number, currency: Currency): string {
  if (currency === "USD") {
    const s = (Math.abs(minor) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${minor < 0 ? "-" : ""}$${s}`;
  }
  return `${minor < 0 ? "-" : ""}Rp${Math.round(Math.abs(minor)).toLocaleString("id-ID")}`;
}

/** Convert between currencies with a USD -> IDR rate. Returns the smallest unit of `to`. */
export function convert(minor: number, from: Currency, to: Currency, usdIdr: number): number {
  if (from === to) return minor;
  if (from === "USD") return Math.round((minor / 100) * usdIdr);
  return Math.round((minor / usdIdr) * 100);
}

/**
 * Reads a decimal number written either way: "1,250.50", "1.250,50", "1250.5", "12,5", "1.250".
 * A last group of exactly three digits is read as thousands.
 */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const sep = Math.max(lastDot, lastComma);
  if (sep < 0) return Number(s);
  const decimals = s.slice(sep + 1);
  const intPart = s.slice(0, sep).replace(/[.,]/g, "");
  const bothUsed = lastDot >= 0 && lastComma >= 0;
  if (!bothUsed && decimals.length === 3) return Number(intPart + decimals);
  const n = Number(`${intPart}.${decimals}`);
  return Number.isFinite(n) ? n : null;
}

const USD_RE =
  /(?:^|[\s(])(?:\$\s?|usd\s?)(\d[\d.,]*)(\s?k)?(?![\w])|(?:^|[\s(])(\d[\d.,]*)(\s?k)?\s?(?:usd|dollars?|dolar)\b/i;

/** Finds a dollar amount ("$1,250.50", "usd 1000", "50 dollar", "$1,5k") and returns cents. */
export function extractUsd(text: string): { cents: number | null; text: string } {
  const m = text.match(USD_RE);
  if (!m || m.index === undefined) return { cents: null, text };
  const num = parseDecimal((m[1] ?? m[3]).replace(/[.,]$/, ""));
  if (num === null) return { cents: null, text };
  const k = m[2] ?? m[4] ? 1000 : 1;
  const cents = Math.round(num * k * 100);
  return {
    cents: cents > 0 ? cents : null,
    text: text.slice(0, m.index) + " " + text.slice(m.index + m[0].length),
  };
}

/** Parses an amount typed into a form for an account in `currency`. */
export function parseFormAmount(raw: string, currency: Currency, idrParser: (s: string) => number | null) {
  const s = raw.trim();
  if (!s) return null;
  const negative = s.startsWith("-");
  const body = s.replace(/^-/, "").trim();
  let value: number | null;
  if (currency === "USD") {
    const usd = extractUsd(body).cents;
    const plain = parseDecimal(body.replace(/^\$/, ""));
    value = usd ?? (plain === null ? null : Math.round(plain * 100));
  } else {
    value = /^\d+$/.test(body) ? Number(body) : idrParser(body);
  }
  return value === null ? null : negative ? -value : value;
}

/** Value for an amount input: 1500000 -> "1500000", 125050 cents -> "1250.50". */
export function toInputValue(minor: number, currency: Currency): string {
  return currency === "USD" ? (minor / 100).toFixed(2) : String(minor);
}
