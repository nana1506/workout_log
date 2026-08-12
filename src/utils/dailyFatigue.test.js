import { describe, it, expect } from "vitest";
import { buildDailyFatigueMap } from "./dailyFatigue";

describe("dailyFatigue utility tests", () => {
  describe("buildDailyFatigueMap", () => {
    it("should return empty object for empty logs", () => {
      expect(buildDailyFatigueMap([])).toEqual({});
    });

    it("should calculate correct fatigue levels for single training days", () => {
      const logs = [
        { completed_at: "2026-08-01T10:00:00Z", title: "Squat", weight_kg: 100, reps: 5, rpe: 8 }
      ];
      
      const fatigueMap = buildDailyFatigueMap(logs);
      expect(fatigueMap["2026-08-01"]).toBeDefined();
      // Since it's the only day, trailing average is calculated from current day, so score is 1.0 (moderate)
      expect(fatigueMap["2026-08-01"].level).toBe("moderate");
      expect(fatigueMap["2026-08-01"].volume).toBe(500);
      expect(fatigueMap["2026-08-01"].avgRpe).toBe(8);
      expect(fatigueMap["2026-08-01"].setCount).toBe(1);
    });

    it("should bucket fatigue scores into correct levels (light, moderate, high, very-high)", () => {
      // Create trailing historical days with constant volume of 1000
      const logs = [
        { completed_at: "2026-08-01T10:00:00Z", title: "Squat", weight_kg: 200, reps: 5, rpe: 7 }, // 1000 vol
        { completed_at: "2026-08-02T10:00:00Z", weight_kg: 200, reps: 5, rpe: 7 }, // 1000 vol
        { completed_at: "2026-08-03T10:00:00Z", weight_kg: 200, reps: 5, rpe: 7 }, // 1000 vol
        // 2026-08-04 has a volume of 400 (score = 400 / 1000 = 0.4 -> light)
        { completed_at: "2026-08-04T10:00:00Z", weight_kg: 80, reps: 5, rpe: 5 },
        // 2026-08-05 has a volume of 1400 (score = 1400 / 850 = 1.64 -> very-high)
        { completed_at: "2026-08-05T10:00:00Z", weight_kg: 280, reps: 5, rpe: 9 }
      ];

      const fatigueMap = buildDailyFatigueMap(logs);
      expect(fatigueMap["2026-08-04"].level).toBe("light");
      expect(fatigueMap["2026-08-05"].level).toBe("very-high");
    });
  });
});
