import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken, SESSION_MAX_AGE } from "./auth";

const SECRET = "a-test-secret-of-sufficient-length";

describe("session token", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("round-trips the user and version", async () => {
    const t = await createSessionToken({ userId: 7, version: 3 });
    expect(await readSessionToken(t!)).toEqual({ userId: 7, version: 3 });
  });
  it("rejects a tampered user id", async () => {
    const t = (await createSessionToken({ userId: 7, version: 0 }))!;
    const forged = t.replace(/^7\./, "1.");
    expect(await readSessionToken(forged)).toBeNull();
  });
  it("rejects a token signed with another secret", async () => {
    const t = (await createSessionToken({ userId: 7, version: 0 }))!;
    process.env.SESSION_SECRET = "a-completely-different-secret-xx";
    expect(await readSessionToken(t)).toBeNull();
  });
  it("rejects an expired token", async () => {
    const t = (await createSessionToken({ userId: 7, version: 0 }, 0))!;
    expect(await readSessionToken(t, (SESSION_MAX_AGE + 5) * 1000)).toBeNull();
  });
  it("rejects garbage and missing tokens", async () => {
    expect(await readSessionToken(undefined)).toBeNull();
    expect(await readSessionToken("abc")).toBeNull();
    expect(await readSessionToken("1.2.3.zzzz")).toBeNull();
  });
  it("is disabled without a strong enough secret", async () => {
    process.env.SESSION_SECRET = "short";
    expect(await createSessionToken({ userId: 1, version: 0 })).toBeNull();
    expect(await readSessionToken("1.0.99999999999.aa")).toBeNull();
  });
});
