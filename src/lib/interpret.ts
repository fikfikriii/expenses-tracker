import { classifyWithAi } from "./ai";
import { detectTransfer, pickAccount, type AccountRef } from "./accounts";
import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_INCOME_CATEGORY,
  guessCategory,
  hasWord,
  looksLikeIncome,
} from "./keywords";
import { parseMessage } from "./parse";

export type CategoryRef = {
  id: number;
  name: string;
  kind: "expense" | "income";
  keywords?: string[];
};

/**
 * A category whose name or user-set keyword appears in the text, e.g. "kopi" -> "Kopi".
 * The longest match wins, so "kopi susu" beats "kopi".
 */
export function matchUserCategory(text: string, categories: CategoryRef[]): CategoryRef | null {
  let best: { cat: CategoryRef; len: number } | null = null;
  for (const cat of categories) {
    for (const term of [cat.name, ...(cat.keywords ?? [])]) {
      const t = term.trim();
      if (t && hasWord(text, t) && (!best || t.length > best.len)) best = { cat, len: t.length };
    }
  }
  return best?.cat ?? null;
}

export type Draft =
  | {
      type: "expense" | "income";
      amount: number;
      date: string;
      accountId: number;
      categoryId: number;
      note: string;
    }
  | {
      type: "transfer";
      amount: number;
      date: string;
      accountId: number;
      toAccountId: number;
      note: string;
    };

export type InterpretResult =
  | { ok: true; draft: Draft; usedAi: boolean }
  | { ok: false; reason: "no_amount" };

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function stripAccountWords(text: string, word: string | null): string {
  if (!word) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`\\b(?:pake|pakai|pk|via|dari|lewat|di|ke)?\\s*${escaped}\\b`, "i"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function interpret(
  text: string,
  ctx: { today: string; accounts: AccountRef[]; categories: CategoryRef[] },
): Promise<InterpretResult> {
  const parsed = parseMessage(text, ctx.today);
  if (!parsed.amount) return { ok: false, reason: "no_amount" };

  const transfer = detectTransfer(parsed.rest, ctx.accounts);
  if (transfer) {
    return {
      ok: true,
      usedAi: false,
      draft: {
        type: "transfer",
        amount: parsed.amount,
        date: parsed.date,
        accountId: transfer.from.id,
        toAccountId: transfer.to.id,
        note: `Transfer ${transfer.from.name} → ${transfer.to.name}`,
      },
    };
  }

  const { account, matchedWord } = pickAccount(parsed.rest, ctx.accounts);
  const rest = stripAccountWords(parsed.rest, matchedWord);

  const expenseCats = ctx.categories.filter((c) => c.kind === "expense");
  const incomeCats = ctx.categories.filter((c) => c.kind === "income");

  const userMatch = matchUserCategory(rest, ctx.categories);
  if (userMatch) {
    return {
      ok: true,
      usedAi: false,
      draft: {
        type: userMatch.kind,
        amount: parsed.amount,
        date: parsed.date,
        accountId: account.id,
        categoryId: userMatch.id,
        note: capitalize(rest),
      },
    };
  }

  const ai = await classifyWithAi({
    text: rest,
    amount: parsed.amount,
    signHint: parsed.sign,
    expenseCategories: expenseCats.map((c) => c.name),
    incomeCategories: incomeCats.map((c) => c.name),
  });

  const type: "expense" | "income" =
    ai?.type ?? (parsed.sign === "+" || looksLikeIncome(rest) ? "income" : "expense");
  const pool = type === "expense" ? expenseCats : incomeCats;
  const fallbackName = type === "expense" ? DEFAULT_EXPENSE_CATEGORY : DEFAULT_INCOME_CATEGORY;

  const byName = (name: string | undefined) =>
    name ? pool.find((c) => c.name.toLowerCase() === name.toLowerCase()) : undefined;

  const category =
    byName(ai?.category) ?? byName(guessCategory(rest, type)) ?? byName(fallbackName) ?? pool[0];
  if (!category) throw new Error(`No ${type} categories. Run the seed migration first.`);

  return {
    ok: true,
    usedAi: Boolean(ai),
    draft: {
      type,
      amount: parsed.amount,
      date: parsed.date,
      accountId: account.id,
      categoryId: category.id,
      note: capitalize(ai?.note?.trim() || rest),
    },
  };
}
