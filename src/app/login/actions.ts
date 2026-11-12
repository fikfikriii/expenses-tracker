"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return "DASHBOARD_PASSWORD belum diisi di Vercel.";
  if (form.get("password") !== expected) return "Password salah.";
  (await cookies()).set(SESSION_COOKIE, await sessionToken(expected), {
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
