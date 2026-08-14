import { describe, it, expect } from "vitest";
import { detectPlateau, detectInjuryRisk } from "./analysis.js";

describe("analysis utility tests", () => {
  describe("detectPlateau", () => {
    it("should return false if series length is less than windowSize", () => {
      const result = detectPlateau([{ date: "2026-08-01", oneRm: 100 }], 5);
      expect(result.isPlateaued).toBe(false);
    });

    it("should flag plateaued (true) if 1RM values are flat/stable", () => {
      const series = [
        { date: "2026-08-01", oneRm: 100 },
        { date: "2026-08-02", oneRm: 100 },
        { date: "2026-08-03", oneRm: 100.2 },
        { date: "2026-08-04", oneRm: 99.8 },
        { date: "2026-08-05", oneRm: 100 }
      ];
      const result = detectPlateau(series, 5, 0.015);
      expect(result.isPlateaued).toBe(true);
    });

    it("should not flag plateaued (false) if 1RM values are rising", () => {
      const series = [
        { date: "2026-08-01", oneRm: 100 },
        { date: "2026-08-02", oneRm: 102 },
        { date: "2026-08-03", oneRm: 105 },
        { date: "2026-08-04", oneRm: 108 },
        { date: "2026-08-05", oneRm: 110 }
      ];
      const result = detectPlateau(series, 5, 0.015);
      expect(result.isPlateaued).toBe(false);
    });
  });

  describe("detectInjuryRisk", () => {
    it("should return level none if logs are too few", () => {
      const result = detectInjuryRisk([]);
      expect(result.level).toBe("none");
    });

    it("should return elevated if there is an RPE spike at equal/higher weight", () => {
      const logs = [
        { completed_at: "2026-08-01T10:00:00Z", weight_kg: 100, reps: 5, rpe: 6 },
        { completed_at: "2026-08-02T10:00:00Z", weight_kg: 100, reps: 5, rpe: 6 },
        { completed_at: "2026-08-03T10:00:00Z", weight_kg: 100, reps: 5, rpe: 8.5 } // spike of 2.5
      ];
      const result = detectInjuryRisk(logs);
      expect(result.level).toBe("elevated");
    });

    it("should return watch for subtle RPE spikes", () => {
      const logs = [
        { completed_at: "2026-08-01T10:00:00Z", weight_kg: 100, reps: 5, rpe: 6 },
        { completed_at: "2026-08-02T10:00:00Z", weight_kg: 100, reps: 5, rpe: 6 },
        { completed_at: "2026-08-03T10:00:00Z", weight_kg: 100, reps: 5, rpe: 7.7 } // spike of 1.7
      ];
      const result = detectInjuryRisk(logs);
      expect(result.level).toBe("watch");
    });

    it("should return none for normal progression", () => {
      const logs = [
        { completed_at: "2026-08-01T10:00:00Z", weight_kg: 100, reps: 5, rpe: 7 },
        { completed_at: "2026-08-02T10:00:00Z", weight_kg: 102, reps: 5, rpe: 7 },
        { completed_at: "2026-08-03T10:00:00Z", weight_kg: 105, reps: 5, rpe: 7 }
      ];
      const result = detectInjuryRisk(logs);
      expect(result.level).toBe("none");
    });
  });
});
