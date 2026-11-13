import { describe, expect, it } from "vitest";
import { accessPolicy, isAllowed, normalizeUsername } from "./users";

describe("access policy", () => {
  it("allows only listed IDs", () => {
    expect(isAllowed(1, "1, 2")).toBe(true);
    expect(isAllowed(3, "1, 2")).toBe(false);
  });
  it("opens up with *", () => {
    expect(isAllowed(3, "*")).toBe(true);
    expect(accessPolicy("*").open).toBe(true);
  });
  it("is locked when empty", () => {
    expect(isAllowed(1, "")).toBe(false);
    expect(accessPolicy("")).toEqual({ open: false, ids: [] });
  });
});

describe("normalizeUsername", () => {
  it("strips @ and lowercases", () => {
    expect(normalizeUsername(" @Fikri_X ")).toBe("fikri_x");
  });
  it("returns null for empty", () => {
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
    expect(normalizeUsername("@")).toBeNull();
  });
});
