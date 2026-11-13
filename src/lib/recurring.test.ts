import { describe, expect, it } from "vitest";
import { dueDateIn, isDue } from "./recurring";

describe("recurring due dates", () => {
  it("uses the day of month", () => {
    expect(dueDateIn("2026-11", 5)).toBe("2026-11-05");
  });
  it("clamps to the last day of short months", () => {
    expect(dueDateIn("2026-11", 31)).toBe("2026-11-30");
    expect(dueDateIn("2026-02", 30)).toBe("2026-02-28");
    expect(dueDateIn("2028-02", 31)).toBe("2028-02-29");
  });
  it("is due on and after its date, once per month", () => {
    const r = { active: true, dayOfMonth: 15, lastRunMonth: null as string | null };
    expect(isDue(r, "2026-11-14")).toBe(false);
    expect(isDue(r, "2026-11-15")).toBe(true);
    expect(isDue(r, "2026-11-20")).toBe(true); // missed run catches up within the month
    expect(isDue({ ...r, lastRunMonth: "2026-11" }, "2026-11-20")).toBe(false);
    expect(isDue({ ...r, lastRunMonth: "2026-10" }, "2026-11-15")).toBe(true);
  });
  it("skips inactive rules", () => {
    expect(isDue({ active: false, dayOfMonth: 1, lastRunMonth: null }, "2026-11-20")).toBe(false);
  });
  it("fires a day-31 rule on Nov 30", () => {
    expect(isDue({ active: true, dayOfMonth: 31, lastRunMonth: null }, "2026-11-30")).toBe(true);
  });
});
