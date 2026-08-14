import { describe, it, expect } from "vitest";
import { generateCSVContent } from "./csv.js";

describe("csv utility tests", () => {
  describe("generateCSVContent", () => {
    it("should return only header row when log array is empty", () => {
      const result = generateCSVContent([]);
      expect(result).toBe("Date,Exercise Title,Muscle Group,Weight (kg),Reps,RPE,Est. 1RM (kg)");
    });

    it("should correctly format logs and escape commas and quotes", () => {
      const logs = [
        {
          completed_at: "2026-08-12T10:00:00Z",
          title: 'Bench Press, Close-Grip',
          muscle_group: "triceps",
          weight_kg: 80,
          reps: 5,
          rpe: 8,
          best_1rm: 93.3
        },
        {
          completed_at: "2026-08-13T10:00:00Z",
          title: 'Dumbbell "Flyes"',
          muscle_group: "chest",
          weight_kg: 20,
          reps: 10,
          rpe: null,
          best_1rm: null
        }
      ];

      const result = generateCSVContent(logs);
      const lines = result.split("\n");

      expect(lines).toHaveLength(3);
      // Check headers
      expect(lines[0]).toBe("Date,Exercise Title,Muscle Group,Weight (kg),Reps,RPE,Est. 1RM (kg)");
      // Check first log row (contains comma) -> should be double quoted
      expect(lines[1]).toBe('2026-08-12,"Bench Press, Close-Grip",triceps,80,5,8,93.3');
      // Check second log row (contains quotes) -> quotes should be escaped
      expect(lines[2]).toBe('2026-08-13,"Dumbbell ""Flyes""",chest,20,10,,26.7'); // Est 1RM = 20 * (1 + 10/30) = 26.666 -> rounded to 26.7
    });
  });
});
