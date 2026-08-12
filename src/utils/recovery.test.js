import { describe, it, expect } from "vitest";
import { getRecoveryHours, MUSCLE_RECOVERY_HOURS } from "./recovery";

describe("recovery utility tests", () => {
  describe("getRecoveryHours", () => {
    it("should return the default hours if muscleGroup is missing", () => {
      expect(getRecoveryHours(null)).toBe(MUSCLE_RECOVERY_HOURS.general); // returns 48 directly
    });

    it("should return base hours * RPE multiplier for valid muscle group and RPE", () => {
      // chest has base 48 hours
      // RPE = 7: multiplier is 1.2 -> 48 * 1.2 = 57.6 (using toBeCloseTo for float precision)
      expect(getRecoveryHours("chest", 7)).toBeCloseTo(57.6, 5);
      
      // biceps has base 24 hours
      // RPE = 9: multiplier is 1.5 -> 24 * 1.5 = 36
      expect(getRecoveryHours("biceps", 9)).toBe(36);
      
      // triceps has base 24 hours
      // RPE = 5: multiplier is 0.8 -> 24 * 0.8 = 19.2
      expect(getRecoveryHours("triceps", 5)).toBeCloseTo(19.2, 5);
    });

    it("should handle normalization of muscle names", () => {
      // "Upper Back" -> "upper_back" (base 54h, RPE 7 multiplier 1.2 -> 64.8)
      expect(getRecoveryHours("Upper Back", 7)).toBeCloseTo(64.8, 5);
    });
  });
});
