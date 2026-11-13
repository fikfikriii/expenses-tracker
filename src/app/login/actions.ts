"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, sessionConfigured } from "@/lib/auth";
import { LOCK_MINUTES, verifyLogin } from "@/lib/users";

const BAD_LOGIN =
  "Username atau password salah. Belum punya password? Kirim /password ke bot Telegram.";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  if (!sessionConfigured()) return "SESSION_SECRET belum diisi di Vercel (minimal 16 karakter).";
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  if (!username.trim() || !password) return BAD_LOGIN;

  const result = await verifyLogin(username, password);
  if (!result.ok) {
    return result.reason === "locked"
      ? `Kebanyakan percobaan salah. Coba lagi ${LOCK_MINUTES} menit lagi.`
      : BAD_LOGIN;
  }

  const token = await createSessionToken({ userId: result.user.id, version: result.user.sessionVersion });
  if (!token) return "SESSION_SECRET belum diisi di Vercel (minimal 16 karakter).";
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
