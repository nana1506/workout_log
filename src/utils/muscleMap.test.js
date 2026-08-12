import { describe, it, expect } from "vitest";
import {
  buildMuscleMapLookup,
  getMusclesForExercise,
  expandLogsWithMuscleStimulus
} from "./muscleMap";

describe("muscleMap utility tests", () => {
  describe("buildMuscleMapLookup", () => {
    it("should return empty Map for empty rows", () => {
      expect(buildMuscleMapLookup([])).toBeInstanceOf(Map);
      expect(buildMuscleMapLookup([]).size).toBe(0);
    });

    it("should group multiple muscles for the same exercise", () => {
      const rows = [
        { exercise_key: "Bench Press", muscle_group: "chest", role: "primary", contribution: 1.0 },
        { exercise_key: "Bench Press", muscle_group: "triceps", role: "secondary", contribution: 0.4 }
      ];
      const lookup = buildMuscleMapLookup(rows);
      expect(lookup.has("Bench Press")).toBe(true);
      expect(lookup.get("Bench Press")).toHaveLength(2);
      expect(lookup.get("Bench Press")[0].muscle_group).toBe("chest");
      expect(lookup.get("Bench Press")[1].muscle_group).toBe("triceps");
    });
  });

  describe("getMusclesForExercise", () => {
    it("should return primary muscle as fallback when exercise is not found in map", () => {
      const lookup = new Map();
      const muscles = getMusclesForExercise("Bench Press", lookup, "chest");
      expect(muscles).toHaveLength(1);
      expect(muscles[0]).toEqual({
        muscle_group: "chest",
        role: "primary",
        contribution: 1.0
      });
    });

    it("should return mapped muscles when exercise is in map", () => {
      const lookup = new Map([
        ["Bench Press", [
          { muscle_group: "chest", role: "primary", contribution: 1.0 },
          { muscle_group: "triceps", role: "secondary", contribution: 0.4 }
        ]]
      ]);
      const muscles = getMusclesForExercise("Bench Press", lookup, "shoulders");
      expect(muscles).toHaveLength(2);
      expect(muscles[0].muscle_group).toBe("chest");
      expect(muscles[1].muscle_group).toBe("triceps");
    });
  });

  describe("expandLogsWithMuscleStimulus", () => {
    it("should expand one log with 2 mapped muscles into 2 events and scale volumes", () => {
      const logs = [
        { completed_at: "2026-08-12T10:00:00Z", title: "Bench Press", muscle_group: "chest", weight_kg: 100, reps: 5, set_id: "s1" }
      ];
      const lookup = new Map([
        ["Bench Press", [
          { muscle_group: "chest", role: "primary", contribution: 1.0 },
          { muscle_group: "triceps", role: "secondary", contribution: 0.4 }
        ]]
      ]);

      const expanded = expandLogsWithMuscleStimulus(logs, lookup);
      expect(expanded).toHaveLength(2);

      // Primary muscle event
      const chestEvent = expanded.find(e => e.stimulus_muscle === "chest");
      expect(chestEvent).toBeDefined();
      expect(chestEvent.role).toBe("primary");
      expect(chestEvent.effectiveVolume).toBe(500); // 100 * 5 * 1.0

      // Secondary muscle event
      const tricepsEvent = expanded.find(e => e.stimulus_muscle === "triceps");
      expect(tricepsEvent).toBeDefined();
      expect(tricepsEvent.role).toBe("secondary");
      expect(tricepsEvent.effectiveVolume).toBe(200); // 100 * 5 * 0.4
    });
  });
});
