import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

describe("password", () => {
  it("verifies the right password only", async () => {
    const h = await hashPassword("rahasia12345");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("rahasia12345", h)).toBe(true);
    expect(await verifyPassword("rahasia12346", h)).toBe(false);
  });
  it("salts every hash", async () => {
    expect(await hashPassword("sama-aja-123")).not.toBe(await hashPassword("sama-aja-123"));
  });
  it("treats a missing or malformed hash as a failed login", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "plaintext")).toBe(false);
  });
  it("enforces length", () => {
    expect(passwordProblem("short")).toMatch(/minimal 8/);
    expect(passwordProblem("a".repeat(129))).toMatch(/maksimal/);
    expect(passwordProblem("panjang-cukup")).toBeNull();
  });
});
