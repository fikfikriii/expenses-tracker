import { describe, expect, it } from "vitest";
import { formatPeriodId, periodKey, periodRange } from "./dates";

describe("budget periods", () => {
  it("is the calendar month by default", () => {
    expect(periodKey("2026-11-25")).toBe("2026-11");
    expect(periodRange("2026-11")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("starting on the 25th, salary day belongs to the next month", () => {
    expect(periodKey("2026-10-24", 25)).toBe("2026-10");
    expect(periodKey("2026-10-25", 25)).toBe("2026-11");
    expect(periodKey("2026-11-24", 25)).toBe("2026-11");
    expect(periodKey("2026-12-25", 25)).toBe("2027-01");
    expect(periodRange("2026-11", 25)).toEqual({ start: "2026-10-25", end: "2026-11-24" });
    expect(periodRange("2027-01", 25)).toEqual({ start: "2026-12-25", end: "2027-01-24" });
  });

  it("every date falls inside the range of its own period", () => {
    for (const day of [1, 2, 15, 25, 28]) {
      for (let i = 0; i < 400; i++) {
        const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
        const { start, end } = periodRange(periodKey(d, day), day);
        expect(d >= start && d <= end).toBe(true);
      }
    }
  });

  it("labels a shifted period with its day range", () => {
    expect(formatPeriodId("2026-11", 1)).toBe("November 2026");
    expect(formatPeriodId("2026-11", 25)).toContain("November 2026 (25 Okt");
  });
});
