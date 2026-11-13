import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from "./defaults";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import type { User } from "@/db/schema";

const { users, accounts, categories } = schema;

// ---------- Access (who may use the bot) ----------

function parseIds(raw: string | undefined): number[] {
  return (raw ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * ALLOWED_TELEGRAM_USER_IDS lists who may use the bot and dashboard.
 * "*" lets anyone in. Empty means locked (the bot only tells people their ID).
 */
export function accessPolicy(env = process.env.ALLOWED_TELEGRAM_USER_IDS): {
  open: boolean;
  ids: number[];
} {
  const open = (env ?? "").split(",").some((s) => s.trim() === "*");
  return { open, ids: parseIds(env) };
}

export function isAllowed(telegramId: number, env = process.env.ALLOWED_TELEGRAM_USER_IDS): boolean {
  const { open, ids } = accessPolicy(env);
  return open || ids.includes(telegramId);
}

/** The first ID in the allowlist is the owner; they inherit data from before multi-user. */
export function isOwner(telegramId: number): boolean {
  return parseIds(process.env.ALLOWED_TELEGRAM_USER_IDS)[0] === telegramId;
}

// ---------- Users ----------

/** "@Fikri_X " -> "fikri_x". Empty or missing -> null. */
export function normalizeUsername(raw: string | null | undefined): string | null {
  const u = (raw ?? "").trim().replace(/^@/, "").toLowerCase();
  return u || null;
}

async function seedDefaults(userId: number) {
  await db()
    .insert(accounts)
    .values(DEFAULT_ACCOUNTS.map((a) => ({ ...a, aliases: [...a.aliases], userId })))
    .onConflictDoNothing();
  await db()
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })))
    .onConflictDoNothing();
  await db().update(users).set({ seeded: true }).where(eq(users.id, userId));
}

/** A Telegram username can move to someone else; free it from its previous holder first. */
async function releaseUsername(username: string | null, exceptUserId?: number) {
  if (!username) return;
  await db()
    .update(users)
    .set({ username: null })
    .where(
      and(eq(users.username, username), exceptUserId ? ne(users.id, exceptUserId) : undefined),
    );
}

/**
 * Finds the user for a Telegram account, creating (and seeding) it on first contact.
 * Keeps the stored username and name in step with Telegram.
 */
export async function ensureUser(
  telegramId: number,
  name: string,
  rawUsername?: string | null,
): Promise<User> {
  const username = normalizeUsername(rawUsername);
  const find = async () =>
    (await db().select().from(users).where(eq(users.telegramId, telegramId)))[0];

  let user = await find();

  if (!user && isOwner(telegramId)) {
    // Pre-multi-user data sits on a placeholder user with no Telegram ID. Claim it once.
    const [legacy] = await db().select().from(users).where(isNull(users.telegramId)).limit(1);
    if (legacy) {
      await releaseUsername(username, legacy.id);
      // The IS NULL guard makes this safe if two messages race: only one update matches.
      await db()
        .update(users)
        .set({ telegramId, name, username })
        .where(and(eq(users.id, legacy.id), isNull(users.telegramId)));
    }
    user = await find();
  }

  if (!user) {
    await releaseUsername(username);
    await db().insert(users).values({ telegramId, name, username }).onConflictDoNothing();
    user = await find();
  }
  if (!user) throw new Error("Could not create user");

  if (user.username !== username || user.name !== name) {
    await releaseUsername(username, user.id);
    await db().update(users).set({ username, name }).where(eq(users.id, user.id));
    user = { ...user, username, name };
  }

  // A crash between insert and seed leaves seeded=false; the seed is idempotent, so just redo it.
  if (!user.seeded) {
    await seedDefaults(user.id);
    user = { ...user, seeded: true };
  }
  return user;
}

export async function getUserById(id: number): Promise<User | undefined> {
  return (await db().select().from(users).where(eq(users.id, id)))[0];
}

// ---------- Passwords and login ----------

/** Sets (or changes) the dashboard password and signs out every existing session. */
export async function setPassword(
  userId: number,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  await db()
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      sessionVersion: sql`${users.sessionVersion} + 1`,
      failedLogins: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, userId));
  return { ok: true };
}

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "locked" };

export async function verifyLogin(rawUsername: string, password: string): Promise<LoginResult> {
  const username = normalizeUsername(rawUsername);
  const user = username
    ? (await db().select().from(users).where(eq(users.username, username)))[0]
    : undefined;

  // Same work whether or not the user exists, so timing doesn't reveal usernames.
  const valid = await verifyPassword(password, user?.passwordHash ?? null);

  if (!user) return { ok: false, reason: "invalid" };
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return { ok: false, reason: "locked" };

  if (!valid || !user.telegramId || !isAllowed(user.telegramId)) {
    if (!valid) {
      const locked = user.failedLogins + 1 >= MAX_FAILED_LOGINS;
      await db()
        .update(users)
        .set({
          failedLogins: locked ? 0 : sql`${users.failedLogins} + 1`,
          lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
        })
        .where(eq(users.id, user.id));
    }
    return { ok: false, reason: "invalid" };
  }

  if (user.failedLogins > 0) {
    await db().update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
  }
  return { ok: true, user };
}

/** Users the cron should message: real Telegram accounts that are still allowed. */
export async function listActiveUsers(): Promise<User[]> {
  const all = await db().select().from(users);
  return all.filter((u) => u.telegramId !== null && isAllowed(u.telegramId));
}
