import { extractDate, extractAmount } from "./parse";
import { extractUsd, parseDecimal, type Currency } from "./money";

/** The new amount typed while editing a transaction, in the account's smallest unit (rupiah or cents). */
export function parseEditAmount(text: string, currency: Currency): number | null {
  if (currency === "USD") {
    const usd = extractUsd(text).cents;
    if (usd) return usd;
    const n = parseDecimal(text.replace(/[^\d.,]/g, ""));
    const cents = n === null ? 0 : Math.round(n * 100);
    return cents > 0 ? cents : null;
  }
  return extractAmount(text).amount;
}

/** The new date typed while editing, or null when the text has no date ("kemarin", "5 Nov", "05/11/2026"...). */
export function parseEditDate(text: string, today: string): string | null {
  const d = extractDate(text, today);
  return d.explicit ? d.date : null;
}

export const NOTE_MAX = 200;

export function parseEditNote(text: string): string | null {
  const note = text.replace(/\s+/g, " ").trim();
  return note && note.length <= NOTE_MAX ? note : null;
}
