// Dashboard session: a signed cookie "<userId>.<sessionVersion>.<expiry>.<signature>".
// Web Crypto only, so the middleware (edge) can verify it without touching the database.
// The signature proves the cookie is ours; whether the user still exists, is still allowed,
// and still has the same password is re-checked against the database in lib/session.ts.

export const SESSION_COOKIE = "et_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionData = { userId: number; version: number };

const enc = new TextEncoder();

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
}

export const sessionConfigured = () => secret() !== null;

async function sign(payload: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(
  data: SessionData,
  now = Date.now(),
): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const payload = `${data.userId}.${data.version}.${Math.floor(now / 1000) + SESSION_MAX_AGE}`;
  return `${payload}.${await sign(payload, key)}`;
}

export async function readSessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<SessionData | null> {
  const key = secret();
  if (!key || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, version, exp, sig] = parts;
  if (!/^\d+$/.test(userId) || !/^\d+$/.test(version) || !/^\d+$/.test(exp)) return null;
  if (Number(exp) * 1000 < now) return null;
  if (!sameString(sig, await sign(`${userId}.${version}.${exp}`, key))) return null;
  return { userId: Number(userId), version: Number(version) };
}
