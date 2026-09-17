import { describe, it, expect } from "vitest";
import {
  buildMuscleMapLookup,
  getMusclesForExercise,
  expandLogsWithMuscleStimulus,
  normalizeExerciseKey,
  normalizeMuscleGroup,
  matchHeuristicMuscles
} from "./muscleMap.js";

describe("muscleMap utility tests", () => {
  describe("normalizeExerciseKey and normalizeMuscleGroup", () => {
    it("should normalize exercise titles and muscle groups cleanly", () => {
      expect(normalizeExerciseKey("  Shrug Dumble!  ")).toBe("shrug dumble");
      expect(normalizeExerciseKey("Dumbbell_Shrug")).toBe("dumbbell shrug");
      expect(normalizeMuscleGroup("Traps")).toBe("traps");
      expect(normalizeMuscleGroup("Upper-Back")).toBe("upper_back");
      expect(normalizeMuscleGroup("Delts")).toBe("shoulders");
    });
  });

  describe("buildMuscleMapLookup", () => {
    it("should return empty Map for empty rows", () => {
      expect(buildMuscleMapLookup([])).toBeInstanceOf(Map);
      expect(buildMuscleMapLookup([]).size).toBe(0);
    });

    it("should group multiple muscles for the same exercise and support case-insensitive keys", () => {
      const rows = [
        { exercise_key: "Bench Press", muscle_group: "chest", role: "primary", contribution: 1.0 },
        { exercise_key: "Bench Press", muscle_group: "triceps", role: "secondary", contribution: 0.4 }
      ];
      const lookup = buildMuscleMapLookup(rows);
      expect(lookup.has("Bench Press")).toBe(true);
      expect(lookup.has("bench press")).toBe(true);
      expect(lookup.get("Bench Press")).toHaveLength(2);
      expect(lookup.get("Bench Press")[0].muscle_group).toBe("chest");
      expect(lookup.get("Bench Press")[1].muscle_group).toBe("triceps");
    });
  });

  describe("getMusclesForExercise", () => {
    it("should automatically map shrug exercises to traps and upper_back via built-in dictionary/heuristics", () => {
      const lookup = new Map();
      const shrug1 = getMusclesForExercise("shrug dumble", lookup, "shoulders");
      expect(shrug1[0].muscle_group).toBe("traps");
      expect(shrug1[0].role).toBe("primary");
      expect(shrug1[1].muscle_group).toBe("upper_back");
      expect(shrug1[1].role).toBe("secondary");

      const shrug2 = getMusclesForExercise("Dumbbell Shrug", lookup, "general");
      expect(shrug2[0].muscle_group).toBe("traps");

      const shrug3 = getMusclesForExercise("Heavy Barbell Shrugs", lookup, "back");
      expect(shrug3[0].muscle_group).toBe("traps");
    });

    it("should return mapped muscles when exercise is in custom lookup", () => {
      const lookup = new Map([
        ["Custom Exercise", [
          { muscle_group: "chest", role: "primary", contribution: 1.0 },
          { muscle_group: "triceps", role: "secondary", contribution: 0.4 }
        ]]
      ]);
      const muscles = getMusclesForExercise("Custom Exercise", lookup, "shoulders");
      expect(muscles).toHaveLength(2);
      expect(muscles[0].muscle_group).toBe("chest");
      expect(muscles[1].muscle_group).toBe("triceps");
    });

    it("should fallback to normalized fallback muscle if exercise is completely unknown and no heuristic matches", () => {
      const lookup = new Map();
      const muscles = getMusclesForExercise("Unknown Movement 123", lookup, "Traps");
      expect(muscles).toHaveLength(1);
      expect(muscles[0]).toEqual({
        muscle_group: "traps",
        role: "primary",
        contribution: 1.0
      });
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

    it("should expand shrug dumble into traps and upper_back events accurately", () => {
      const logs = [
        { completed_at: "2026-09-16T10:00:00Z", title: "shrug dumble", muscle_group: "shoulders", weight_kg: 30, reps: 12, set_id: "s2" }
      ];
      const lookup = new Map();
      const expanded = expandLogsWithMuscleStimulus(logs, lookup);
      expect(expanded).toHaveLength(2);

      const trapsEvent = expanded.find(e => e.stimulus_muscle === "traps");
      expect(trapsEvent).toBeDefined();
      expect(trapsEvent.role).toBe("primary");
      expect(trapsEvent.effectiveVolume).toBe(360); // 30 * 12 * 1.0

      const upperBackEvent = expanded.find(e => e.stimulus_muscle === "upper_back");
      expect(upperBackEvent).toBeDefined();
      expect(upperBackEvent.role).toBe("secondary");
      expect(upperBackEvent.effectiveVolume).toBeCloseTo(108, 1); // 30 * 12 * 0.3
    });
  });
});
