import { describe, it, expect } from "vitest";
import {
  estOneRM,
  linregSlope,
  fmtDate,
  acwrZone,
  getTrainingSplit,
  getRadarMuscleCategory,
  buildOneRmSeries,
  getSessionKey,
  countSessions,
  countSets,
  countReps,
  calcVolume
} from "./calculations.js";

describe("calculations utility tests", () => {
  describe("estOneRM", () => {
    it("should calculate correct Epley 1RM for standard values", () => {
      // 100 * (1 + 5 / 30) = 100 * 1.1667 = 116.666 -> rounded to 116.7
      expect(estOneRM(100, 5)).toBe(116.7);
    });

    it("should return 0 when weight or reps is 0", () => {
      expect(estOneRM(0, 5)).toBe(0);
      expect(estOneRM(100, 0)).toBe(0);
      expect(estOneRM(null, undefined)).toBe(0);
    });
  });

  describe("linregSlope", () => {
    it("should return correct positive slope for upward trend", () => {
      const points = [{ x: 1, y: 10 }, { x: 2, y: 20 }, { x: 3, y: 30 }];
      expect(linregSlope(points)).toBe(10);
    });

    it("should return 0 for a flat series", () => {
      const points = [{ x: 1, y: 50 }, { x: 2, y: 50 }, { x: 3, y: 50 }];
      expect(linregSlope(points)).toBe(0);
    });

    it("should return 0 for a single point or empty array", () => {
      expect(linregSlope([{ x: 1, y: 10 }])).toBe(0);
      expect(linregSlope([])).toBe(0);
    });
  });

  describe("fmtDate", () => {
    it("should format ISO string to short format", () => {
      expect(fmtDate("2026-08-12T12:00:00Z")).toMatch(/Aug (12|11)/); // depending on test environment timezone
      expect(fmtDate("")).toBe("");
    });
  });

  describe("acwrZone", () => {
    it("should return correct category for low ACWR (<0.8)", () => {
      const zone = acwrZone(0.7);
      expect(zone.label).toBe("Low stimulus");
      expect(zone.color).toBe("#7FA6FF");
    });

    it("should return correct category for sweet spot (0.8 - 1.3)", () => {
      const zone1 = acwrZone(0.8);
      const zone2 = acwrZone(1.2);
      expect(zone1.label).toBe("Sweet spot");
      expect(zone2.label).toBe("Sweet spot");
    });

    it("should return correct category for caution (1.3 - 1.5)", () => {
      const zone1 = acwrZone(1.4);
      const zone2 = acwrZone(1.5);
      expect(zone1.label).toBe("Caution");
      expect(zone2.label).toBe("Caution");
    });

    it("should return correct category for high risk (>1.5)", () => {
      const zone = acwrZone(1.6);
      expect(zone.label).toBe("High risk");
    });
  });

  describe("getTrainingSplit", () => {
    it("should map chest to Upper", () => {
      expect(getTrainingSplit("chest").split).toBe("Upper");
    });

    it("should map biceps to Arms", () => {
      expect(getTrainingSplit("biceps").split).toBe("Arms");
    });

    it("should map calves to Legs", () => {
      expect(getTrainingSplit("calves").split).toBe("Legs");
    });

    it("should map core to Core", () => {
      expect(getTrainingSplit("abdominals").split).toBe("Core");
    });

    it("should fallback to Other for unknown muscle group", () => {
      expect(getTrainingSplit("face").split).toBe("Other");
    });
  });

  describe("buildOneRmSeries", () => {
    it("should return empty array for empty logs", () => {
      expect(buildOneRmSeries([])).toEqual([]);
    });

    it("should build series and flag PRs correctly", () => {
      const logs = [
        { completed_at: "2026-08-01T10:00:00Z", title: "Squat", weight_kg: 100, reps: 5, set_id: "s1" },
        { completed_at: "2026-08-02T10:00:00Z", title: "Squat", weight_kg: 110, reps: 5, set_id: "s2" },
        { completed_at: "2026-08-03T10:00:00Z", title: "Squat", weight_kg: 90, reps: 5, set_id: "s3" }
      ];
      const series = buildOneRmSeries(logs, false);
      expect(series).toHaveLength(3);
      expect(series[0].isPR).toBe(true);
      expect(series[1].isPR).toBe(true);
      expect(series[2].isPR).toBe(false); // lower weight is not a PR
    });
  });

  describe("metric aggregation helpers", () => {
    const sampleLogs = [
      { completed_at: "2026-08-01T10:00:00Z", title: "Squat", weight_kg: 100, reps: 5, set_id: "w1-s1" },
      { completed_at: "2026-08-01T10:05:00Z", title: "Squat", weight_kg: 100, reps: 5, set_id: "w1-s2" },
      { completed_at: "2026-08-02T10:00:00Z", title: "Bench", weight_kg: 80, reps: 8, set_id: "w2-s1" },
      { completed_at: "2026-08-03T10:00:00Z", title: "Deadlift", weight_kg: 120, reps: 3 } // no set_id, fallback to date
    ];

    it("getSessionKey correctly derives session from set_id or date", () => {
      expect(getSessionKey(sampleLogs[0])).toBe("w1");
      expect(getSessionKey(sampleLogs[1])).toBe("w1");
      expect(getSessionKey(sampleLogs[2])).toBe("w2");
      expect(getSessionKey(sampleLogs[3])).toBe("2026-08-03");
      expect(getSessionKey(null)).toBe("");
    });

    it("countSessions correctly counts distinct sessions", () => {
      expect(countSessions(sampleLogs)).toBe(3); // w1, w2, 2026-08-03
      expect(countSessions([])).toBe(0);
      expect(countSessions(null)).toBe(0);
    });

    it("countSets correctly returns number of set records", () => {
      expect(countSets(sampleLogs)).toBe(4);
      expect(countSets([])).toBe(0);
      expect(countSets(null)).toBe(0);
    });

    it("countReps correctly sums up all repetitions", () => {
      // 5 + 5 + 8 + 3 = 21 reps
      expect(countReps(sampleLogs)).toBe(21);
      expect(countReps([])).toBe(0);
      expect(countReps(null)).toBe(0);
    });

    it("calcVolume correctly calculates total volume (weight * reps)", () => {
      // (100*5) + (100*5) + (80*8) + (120*3) = 500 + 500 + 640 + 360 = 2000 kg
      expect(calcVolume(sampleLogs)).toBe(2000);
      expect(calcVolume([])).toBe(0);
      expect(calcVolume(null)).toBe(0);
    });
  });
});

