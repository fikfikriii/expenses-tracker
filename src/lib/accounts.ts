import { hasWord } from "./keywords";

export type AccountRef = {
  id: number;
  name: string;
  aliases: string[];
  isDefault: boolean;
  currency?: "IDR" | "USD";
};

const TRANSFER_RE = /^\s*(?:transfer|trf|tf|pindah(?:in)?|mindahin|topup|top\s*up|isi\s+saldo)\b/i;

function mentions(text: string, account: AccountRef): { index: number; word: string } | null {
  let best: { index: number; word: string } | null = null;
  for (const word of [account.name, ...account.aliases]) {
    if (!word || !hasWord(text, word)) continue;
    const index = text.toLowerCase().indexOf(word.toLowerCase());
    if (!best || index < best.index) best = { index, word };
  }
  return best;
}

export function defaultAccount(accounts: AccountRef[]): AccountRef {
  const acc = accounts.find((a) => a.isDefault) ?? accounts[0];
  if (!acc) throw new Error("No accounts. Run the seed migration first.");
  return acc;
}

/** Account named in the text ("50rb bensin pake bca"), else the default account. */
export function pickAccount(text: string, accounts: AccountRef[]): {
  account: AccountRef;
  matchedWord: string | null;
} {
  let found: { account: AccountRef; index: number; word: string } | null = null;
  for (const account of accounts) {
    const m = mentions(text, account);
    if (m && (!found || m.index < found.index)) found = { account, ...m };
  }
  return found
    ? { account: found.account, matchedWord: found.word }
    : { account: defaultAccount(accounts), matchedWord: null };
}

export type TransferMatch = { from: AccountRef; to: AccountRef };

/**
 * "transfer 1jt bca ke gopay", "tf 500rb dari bca ke seabank", "topup gopay 100rb dari bca".
 * Returns null when this is not a transfer or the accounts can't be told apart.
 */
export function detectTransfer(text: string, accounts: AccountRef[]): TransferMatch | null {
  if (!TRANSFER_RE.test(text)) return null;

  const found = accounts
    .map((account) => ({ account, m: mentions(text, account) }))
    .filter((x): x is { account: AccountRef; m: { index: number; word: string } } => x.m !== null)
    .sort((a, b) => a.m.index - b.m.index);

  const lower = text.toLowerCase();
  const after = (kw: string, x: (typeof found)[number]) =>
    new RegExp(`(^|\\s)${kw}$`).test(lower.slice(0, x.m.index).trimEnd());

  const to = found.find((x) => after("ke", x));
  const from = found.find((x) => after("dari", x));
  const isTopup = /^\s*(?:topup|top\s*up|isi\s+saldo)\b/i.test(text);

  let fromAcc = from?.account;
  let toAcc = to?.account;
  const others = found.map((x) => x.account).filter((a) => a !== fromAcc && a !== toAcc);

  if (isTopup) {
    // "topup gopay 100rb (dari bca)": the first unlabeled account is the target.
    toAcc ??= others.shift();
    fromAcc ??= others.shift() ?? defaultAccount(accounts);
  } else {
    // "transfer 1jt bca ke gopay": the first unlabeled account is the source.
    fromAcc ??= others.shift() ?? defaultAccount(accounts);
    toAcc ??= others.shift();
  }

  if (!fromAcc || !toAcc || fromAcc.id === toAcc.id) return null;
  return { from: fromAcc, to: toAcc };
}
