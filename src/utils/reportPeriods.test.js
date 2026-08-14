import { describe, it, expect } from "vitest";
import {
  getPreviousIsoWeek,
  getPreviousCalendarMonth,
  getPriorPeriodWindow,
  formatDateYMD,
} from "./reportPeriods.js";

describe("reportPeriods (strict UTC)", () => {
  describe("getPreviousIsoWeek", () => {
    it("returns correct previous week when reference is Monday (typical cron execution)", () => {
      // 2026-08-17 is Monday
      const res = getPreviousIsoWeek(new Date("2026-08-17T08:00:00Z"));
      expect(res.start).toBe("2026-08-10"); // Monday
      expect(res.end).toBe("2026-08-16");   // Sunday
    });

    it("returns correct previous week when reference is mid-week Wednesday", () => {
      // 2026-08-19 is Wednesday
      const res = getPreviousIsoWeek(new Date("2026-08-19T14:30:00Z"));
      expect(res.start).toBe("2026-08-10");
      expect(res.end).toBe("2026-08-16");
    });

    it("returns correct previous week when reference is Sunday", () => {
      // 2026-08-16 is Sunday
      const res = getPreviousIsoWeek(new Date("2026-08-16T22:00:00Z"));
      expect(res.start).toBe("2026-08-03");
      expect(res.end).toBe("2026-08-09");
    });

    it("handles year rollover gracefully in UTC", () => {
      // 2026-01-05 is Monday
      const res = getPreviousIsoWeek(new Date("2026-01-05T09:00:00Z"));
      expect(res.start).toBe("2025-12-29");
      expect(res.end).toBe("2026-01-04");
    });
  });

  describe("getPreviousCalendarMonth", () => {
    it("returns previous month when run on the 1st of month (typical monthly cron execution)", () => {
      // 2026-08-01
      const res = getPreviousCalendarMonth(new Date("2026-08-01T08:00:00Z"));
      expect(res.start).toBe("2026-07-01");
      expect(res.end).toBe("2026-07-31");
    });

    it("returns previous month when run mid-month", () => {
      // 2026-08-14
      const res = getPreviousCalendarMonth(new Date("2026-08-14T10:00:00Z"));
      expect(res.start).toBe("2026-07-01");
      expect(res.end).toBe("2026-07-31");
    });

    it("handles February leap year vs non-leap year correctly in UTC", () => {
      // 2024 is leap year -> March 1 returns Feb 1 to Feb 29
      const res2024 = getPreviousCalendarMonth(new Date("2024-03-01T00:00:00Z"));
      expect(res2024.start).toBe("2024-02-01");
      expect(res2024.end).toBe("2024-02-29");

      // 2026 is non-leap year -> March 1 returns Feb 1 to Feb 28
      const res2026 = getPreviousCalendarMonth(new Date("2026-03-01T00:00:00Z"));
      expect(res2026.start).toBe("2026-02-01");
      expect(res2026.end).toBe("2026-02-28");
    });

    it("handles year rollover in January in UTC", () => {
      // 2026-01-01
      const res = getPreviousCalendarMonth(new Date("2026-01-01T08:00:00Z"));
      expect(res.start).toBe("2025-12-01");
      expect(res.end).toBe("2025-12-31");
    });
  });

  describe("getPriorPeriodWindow", () => {
    it("computes prior weekly window", () => {
      const prior = getPriorPeriodWindow("weekly", "2026-08-10", "2026-08-16");
      expect(prior.start).toBe("2026-08-03");
      expect(prior.end).toBe("2026-08-09");
    });

    it("computes prior monthly window", () => {
      const prior = getPriorPeriodWindow("monthly", "2026-07-01", "2026-07-31");
      expect(prior.start).toBe("2026-06-01");
      expect(prior.end).toBe("2026-06-30");
    });
  });
});
