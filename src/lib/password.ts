import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Node-only (scrypt). Never import this from middleware.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const KEYLEN = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** "scrypt$<salt hex>$<hash hex>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, saltHex, keyHex] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) {
    // Still burn the same time so "no such user" can't be told apart by speed.
    await derive(password, Buffer.alloc(16));
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter.`;
  if (password.length > PASSWORD_MAX) return `Password maksimal ${PASSWORD_MAX} karakter.`;
  return null;
}
