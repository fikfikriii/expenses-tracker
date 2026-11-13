"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { extractAmount } from "@/lib/parse";
import { schema } from "@/db";
import { convert, parseFormAmount, type Currency } from "@/lib/money";
import { createRecurring, deleteRecurring, updateRecurring } from "@/lib/recurring";
import { todayJakarta } from "@/lib/dates";
import { currentRate, deleteRate, saveRate } from "@/lib/fx";
import {
  createAccount,
  createCategory,
  createTransaction,
  deleteSnapshot,
  deleteTransaction,
  listAllAccounts,
  saveSnapshots,
  setBudget,
  updateAccount,
  updateCategory,
  updateTransaction,
  type TxInput,
} from "@/lib/ledger";

async function requireAuth() {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value))) redirect("/login");
}

export type FormState = { error?: string; ok?: boolean } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const n = Number(f.get(k));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Amount for an account currency: "15rb" / "1,5jt" for IDR, "1250.50" / "$1,250.50" for USD. */
function moneyFrom(f: FormData, k: string, currency: Currency): number | null {
  return parseFormAmount(str(f, k), currency, (s) => extractAmount(s).amount);
}

/** "Latte, starbucks ,kopken" -> ["latte", "starbucks", "kopken"] */
function splitList(raw: string): string[] {
  return [...new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

function refresh() {
  revalidatePath("/", "layout");
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

async function readTx(f: FormData): Promise<TxInput | string> {
  const type = str(f, "type") as TxInput["type"];
  if (!["expense", "income", "transfer"].includes(type)) return "Tipe transaksi nggak valid.";
  const occurredOn = str(f, "occurredOn");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return "Tanggal nggak valid.";
  const accountId = int(f, "accountId");
  if (!accountId) return "Pilih akun.";
  const toAccountId = type === "transfer" ? int(f, "toAccountId") : null;
  if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
    return "Pilih akun tujuan yang beda.";
  }
  const categoryId = type === "transfer" ? null : int(f, "categoryId");
  if (type !== "transfer" && !categoryId) return "Pilih kategori.";

  const accs = await listAllAccounts();
  const cur = (id: number | null): Currency => accs.find((a) => a.id === id)?.currency ?? "IDR";
  const amount = moneyFrom(f, "amount", cur(accountId));
  if (!amount || amount <= 0) return "Nominal nggak kebaca.";

  let toAmount: number | null = null;
  if (type === "transfer" && cur(accountId) !== cur(toAccountId)) {
    toAmount = moneyFrom(f, "toAmount", cur(toAccountId));
    if (!toAmount) {
      const rate = await currentRate();
      if (!rate) return "Kurs USD belum ada. Isi nominal yang diterima, atau isi kurs di halaman Saldo.";
      toAmount = convert(amount, cur(accountId), cur(toAccountId!), rate);
    }
  }
  return { type, amount, toAmount, occurredOn, accountId, toAccountId, categoryId, note: str(f, "note") };
}

export async function saveTransaction(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const input = await readTx(f);
  if (typeof input === "string") return { error: input };
  const id = int(f, "id");
  if (id) await updateTransaction(id, input);
  else await createTransaction(input);
  refresh();
  if (id) redirect(str(f, "returnTo") || "/transactions");
  return { ok: true };
}

export async function removeTransaction(f: FormData) {
  await requireAuth();
  const id = int(f, "id");
  if (id) await deleteTransaction(id);
  refresh();
  redirect(str(f, "returnTo") || "/transactions");
}

const ACCOUNT_TYPES = schema.accountType.enumValues;

export async function saveAccount(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const name = str(f, "name");
  if (!name) return { error: "Nama akun wajib diisi." };
  const type = str(f, "type") as (typeof ACCOUNT_TYPES)[number];
  if (!ACCOUNT_TYPES.includes(type)) return { error: "Tipe akun nggak valid." };
  const raw = str(f, "initialBalance");
  const initialBalance = raw ? moneyFrom(f, "initialBalance", str(f, "currency") === "USD" ? "USD" : "IDR") : 0;
  if (initialBalance === null) return { error: "Saldo awal nggak kebaca." };
  const aliases = splitList(str(f, "aliases"));
  const currency = str(f, "currency") === "USD" ? "USD" : "IDR";
  const input = {
    name,
    type,
    currency: currency as Currency,
    aliases,
    initialBalance,
    isDefault: f.get("isDefault") === "on",
    archived: f.get("archived") === "on",
  };
  if (input.isDefault && input.archived) return { error: "Akun default nggak bisa diarsipkan." };
  const id = int(f, "id");
  try {
    if (id) await updateAccount(id, input);
    else await createAccount(input);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Akun "${name}" udah ada.` };
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function saveCategory(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const name = str(f, "name");
  if (!name) return { error: "Nama kategori wajib diisi." };
  const icon = str(f, "icon");
  const keywords = splitList(str(f, "keywords"));
  const archived = f.get("archived") === "on";
  const id = int(f, "id");
  try {
    if (id) {
      await updateCategory(id, { name, icon, keywords, archived });
    } else {
      const kind = str(f, "kind");
      if (kind !== "expense" && kind !== "income") return { error: "Jenis kategori nggak valid." };
      await createCategory({ name, kind, icon, keywords, archived });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Kategori "${name}" udah ada.` };
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function saveBalances(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const takenOn = str(f, "takenOn");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) return { error: "Tanggal nggak valid." };
  const accs = await listAllAccounts();
  const items: { accountId: number; balance: number }[] = [];
  for (const [key] of f.entries()) {
    const m = key.match(/^bal_(\d+)$/);
    if (!m || !str(f, key)) continue;
    const accountId = Number(m[1]);
    const value = moneyFrom(f, key, accs.find((a) => a.id === accountId)?.currency ?? "IDR");
    if (value === null) return { error: `Saldo "${str(f, key)}" nggak kebaca.` };
    items.push({ accountId, balance: value });
  }
  if (items.length === 0) return { error: "Isi minimal satu saldo." };
  await saveSnapshots(takenOn, items);
  refresh();
  return { ok: true };
}

export async function removeSnapshot(f: FormData) {
  await requireAuth();
  const id = int(f, "id");
  if (id) await deleteSnapshot(id);
  refresh();
}

export async function saveFxRate(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const rateOn = str(f, "rateOn");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rateOn)) return { error: "Tanggal nggak valid." };
  const rate = extractAmount(str(f, "usdIdr")).amount ?? Number(str(f, "usdIdr").replace(/\./g, "").replace(",", "."));
  if (!rate || rate < 1000 || rate > 100000) return { error: "Kurs nggak masuk akal (contoh: 16300)." };
  await saveRate(rateOn, rate, "manual");
  refresh();
  return { ok: true };
}

export async function removeFxRate(f: FormData) {
  await requireAuth();
  const rateOn = str(f, "rateOn");
  if (rateOn) await deleteRate(rateOn);
  refresh();
}

export async function saveBudget(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const categoryId = int(f, "categoryId");
  if (!categoryId) return { error: "Kategori nggak valid." };
  const raw = str(f, "limit");
  const limit = raw ? moneyFrom(f, "limit", "IDR") : null;
  if (raw && (!limit || limit <= 0)) return { error: "Nominal nggak kebaca." };
  await setBudget(categoryId, limit);
  refresh();
  return { ok: true };
}

export async function saveRecurring(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const rawType = str(f, "type");
  if (rawType !== "expense" && rawType !== "income") return { error: "Tipe nggak valid." };
  const type: "expense" | "income" = rawType;
  const accountId = int(f, "accountId");
  const categoryId = int(f, "categoryId");
  if (!accountId) return { error: "Pilih akun." };
  if (!categoryId) return { error: "Pilih kategori." };
  const day = int(f, "dayOfMonth");
  if (!day || day > 31) return { error: "Tanggal harus 1 sampai 31." };
  const accs = await listAllAccounts();
  const currency = accs.find((a) => a.id === accountId)?.currency ?? "IDR";
  const amount = moneyFrom(f, "amount", currency);
  if (!amount || amount <= 0) return { error: "Nominal nggak kebaca." };
  const input = { type, amount, accountId, categoryId, note: str(f, "note"), dayOfMonth: day, active: f.get("active") === "on" };
  const id = int(f, "id");
  if (id) await updateRecurring(id, input);
  else await createRecurring({ ...input, active: true }, todayJakarta());
  refresh();
  return { ok: true };
}

export async function removeRecurring(f: FormData) {
  await requireAuth();
  const id = int(f, "id");
  if (id) await deleteRecurring(id);
  refresh();
}
