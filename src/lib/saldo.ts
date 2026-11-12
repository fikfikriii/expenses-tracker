import { hasWord } from "./keywords";
import { extractAmount, extractDate } from "./parse";
import { extractUsd, parseDecimal } from "./money";
import type { AccountRef } from "./accounts";

export type SaldoParse = {
  date: string;
  items: { account: AccountRef; balance: number }[];
  /** Accounts named without a readable amount. */
  missing: AccountRef[];
};

const PREFIX_RE = /^\s*\/?saldo(?:@\w+)?\b/i;

export function isSaldoMessage(text: string): boolean {
  return PREFIX_RE.test(text);
}

function mentions(text: string, accounts: AccountRef[]) {
  const lower = text.toLowerCase();
  const found: { account: AccountRef; start: number; end: number }[] = [];
  for (const account of accounts) {
    for (const word of [account.name, ...account.aliases]) {
      const w = word.trim().toLowerCase();
      if (!w) continue;
      let from = 0;
      for (;;) {
        const i = lower.indexOf(w, from);
        if (i < 0) break;
        from = i + w.length;
        const before = lower[i - 1] ?? " ";
        const after = lower[i + w.length] ?? " ";
        if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
        found.push({ account, start: i, end: i + w.length });
      }
    }
  }
  // Drop matches inside a longer match ("sea" inside "sea bank").
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: typeof found = [];
  for (const m of found) {
    const last = kept.at(-1);
    if (last && m.start < last.end) continue;
    kept.push(m);
  }
  return kept;
}

/**
 * "saldo bca 5,2jt mandiri 3,1jt seabank 800rb"
 * "saldo 31 okt bca: 5.200.000, mandiri 3jt"
 * Returns null when the text has no account balances (e.g. just "/saldo").
 */
export function parseSaldo(text: string, accounts: AccountRef[], today: string): SaldoParse | null {
  const body = text.replace(PREFIX_RE, " ");
  const d = extractDate(body, today);
  const rest = d.text;
  const found = mentions(rest, accounts);
  if (found.length === 0) return null;

  const items: SaldoParse["items"] = [];
  const missing: AccountRef[] = [];
  found.forEach((m, i) => {
    const segment = rest.slice(m.end, found[i + 1]?.start ?? rest.length);
    const clean = segment.replace(/^[\s:=]+/, " ");
    const amount = m.account.currency === "USD" ? usdCents(clean) : extractAmount(clean).amount;
    const already = items.some((x) => x.account.id === m.account.id);
    if (amount === null) {
      if (!already) missing.push(m.account);
    } else if (!already) {
      items.push({ account: m.account, balance: amount });
    }
  });
  return { date: d.date, items, missing };
}

/** "$1,250.50", "1250.5 usd" or a plain "1.250,50" (for a USD account) -> cents. */
function usdCents(segment: string): number | null {
  const u = extractUsd(segment).cents;
  if (u !== null) return u;
  const tok = segment.match(/\d[\d.,]*/)?.[0]?.replace(/[.,]$/, "");
  const n = tok ? parseDecimal(tok) : null;
  return n === null ? null : Math.round(n * 100);
}

export { hasWord };
