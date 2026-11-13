import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionToken } from "./auth";
import { getUserById, isAllowed } from "./users";
import type { User } from "@/db/schema";

/** The logged-in user, or null. Re-checks the database so a password change or removal logs people out. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.sessionVersion !== session.version) return null;
  if (!user.telegramId || !isAllowed(user.telegramId)) return null;
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
