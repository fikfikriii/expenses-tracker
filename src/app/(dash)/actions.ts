"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { extractAmount } from "@/lib/parse";
import { schema } from "@/db";
import {
  createAccount,
  createCategory,
  createTransaction,
  deleteTransaction,
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

/** Accepts "15000", "15.000", "15rb", "1,5jt". */
function amountFrom(f: FormData, k: string): number | null {
  const raw = str(f, k);
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return extractAmount(raw).amount;
}

function refresh() {
  revalidatePath("/", "layout");
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

function readTx(f: FormData): TxInput | string {
  const type = str(f, "type") as TxInput["type"];
  if (!["expense", "income", "transfer"].includes(type)) return "Tipe transaksi nggak valid.";
  const amount = amountFrom(f, "amount");
  if (!amount || amount <= 0) return "Nominal nggak kebaca.";
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
  return { type, amount, occurredOn, accountId, toAccountId, categoryId, note: str(f, "note") };
}

export async function saveTransaction(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const input = readTx(f);
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
  const initialBalance = raw ? amountFrom(f, "initialBalance") : 0;
  if (initialBalance === null) return { error: "Saldo awal nggak kebaca." };
  const aliases = str(f, "aliases")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const input = {
    name,
    type,
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
  const archived = f.get("archived") === "on";
  const id = int(f, "id");
  try {
    if (id) {
      await updateCategory(id, { name, icon, archived });
    } else {
      const kind = str(f, "kind");
      if (kind !== "expense" && kind !== "income") return { error: "Jenis kategori nggak valid." };
      await createCategory({ name, kind, icon, archived });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Kategori "${name}" udah ada.` };
    throw e;
  }
  refresh();
  return { ok: true };
}
