import { describe, it, expect } from "vitest";
import { extractWorkoutId, flattenHevyWorkout } from "./hevySync";

describe("hevySync utility tests", () => {
  describe("extractWorkoutId", () => {
    it("extracts ID from raw ID string", () => {
      expect(extractWorkoutId("c0a87588-433b-48ae-94a0-bfad1e8fa8ec")).toBe("c0a87588-433b-48ae-94a0-bfad1e8fa8ec");
      expect(extractWorkoutId("gR9V1s3a")).toBe("gR9V1s3a");
    });

    it("extracts ID from full Hevy URLs", () => {
      expect(extractWorkoutId("https://hevy.com/workout/gR9V1s3a")).toBe("gR9V1s3a");
      expect(extractWorkoutId("https://hevy.com/workout/gR9V1s3a/")).toBe("gR9V1s3a");
      expect(extractWorkoutId("https://api.hevyapp.com/workout/gR9V1s3a?include=exercises")).toBe("gR9V1s3a");
      expect(extractWorkoutId("https://hevy.com/workout/c0a87588-433b-48ae-94a0-bfad1e8fa8ec#section")).toBe("c0a87588-433b-48ae-94a0-bfad1e8fa8ec");
    });

    it("handles whitespace and empty inputs", () => {
      expect(extractWorkoutId("   gR9V1s3a   ")).toBe("gR9V1s3a");
      expect(extractWorkoutId("")).toBe("");
      expect(extractWorkoutId(null)).toBe("");
      expect(extractWorkoutId(undefined)).toBe("");
    });
  });

  describe("flattenHevyWorkout", () => {
    const sampleHevyResponse = {
      short_id: "wk_short_123",
      title: "Chest & Triceps Hypertrophy",
      end_time: "2026-10-01T10:00:00.000Z",
      exercises: [
        {
          id: "ex_bench_press",
          title: "Bench Press (Barbell)",
          muscle_group: "chest",
          sets: [
            {
              id: "set_101",
              weight_kg: 80,
              rpe: 8,
              reps: 10,
              index: 0,
              completed_at: "2026-10-01T09:15:00.000Z",
              prs: [
                { type: "best_weight", value: 80 },
                { type: "best_volume", value: 800 },
                { type: "best_1rm", value: 106.7 }
              ]
            },
            {
              id: "set_102",
              weight_kg: 85,
              rpe: 9,
              reps: 8,
              index: 1,
              completed_at: "2026-10-01T09:20:00.000Z",
              prs: [
                { type: "best_weight", value: 85 }
              ]
            }
          ]
        },
        {
          id: "ex_tricep_pushdown",
          title: "Tricep Pushdown (Cable)",
          muscle_group: "triceps",
          sets: [
            {
              id: "set_201",
              weight_kg: 35,
              rpe: 7.5,
              reps: 12,
              index: 0,
              completed_at: "2026-10-01T09:35:00.000Z",
              prs: []
            }
          ]
        }
      ]
    };

    it("correctly flattens multi-exercise workout into individual set records", () => {
      const fixedInsertedAt = "2026-10-01T12:00:00.000Z";
      const result = flattenHevyWorkout(sampleHevyResponse, "fallback_id", fixedInsertedAt);

      expect(result.workout_id).toBe("wk_short_123");
      expect(result.workout_title).toBe("Chest & Triceps Hypertrophy");
      expect(result.rows).toHaveLength(3);

      // Verify Set 1
      const set1 = result.rows[0];
      expect(set1).toEqual({
        work_id: "ex_bench_press",
        title: "Bench Press (Barbell)",
        set_id: "set_101",
        weight_kg: 80,
        rpe: 8,
        reps: 10,
        index: 0,
        best_weight: 80,
        best_volume: 800,
        best_1rm: 106.7,
        muscle_group: "chest",
        completed_at: "2026-10-01T09:15:00.000Z",
        workout_id: "wk_short_123",
        inserted_at: fixedInsertedAt
      });

      // Verify Set 2 with partial PRs
      const set2 = result.rows[1];
      expect(set2.best_weight).toBe(85);
      expect(set2.best_volume).toBeNull();
      expect(set2.best_1rm).toBeNull();

      // Verify Set 3 with no PRs
      const set3 = result.rows[2];
      expect(set3.work_id).toBe("ex_tricep_pushdown");
      expect(set3.best_weight).toBeNull();
      expect(set3.best_volume).toBeNull();
      expect(set3.best_1rm).toBeNull();
    });

    it("handles nested workout object format { workout: { ... } }", () => {
      const nestedResponse = {
        workout: {
          short_id: "nested_short_999",
          title: "Leg Day",
          exercises: [
            {
              id: "ex_squat",
              title: "Squat (Barbell)",
              muscle_group: "quadriceps",
              sets: [
                {
                  id: "set_squat_1",
                  weight_kg: 120,
                  reps: 5,
                  rpe: 8.5,
                  index: 0
                }
              ]
            }
          ]
        }
      };

      const result = flattenHevyWorkout(nestedResponse, "fallback");
      expect(result.workout_id).toBe("nested_short_999");
      expect(result.workout_title).toBe("Leg Day");
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("Squat (Barbell)");
      expect(result.rows[0].muscle_group).toBe("quadriceps");
      expect(result.rows[0].weight_kg).toBe(120);
    });

    it("handles missing or null fields gracefully", () => {
      const sparseResponse = {
        exercises: [
          {
            id: null,
            title: "Bodyweight Dips",
            sets: [
              {
                id: null,
                weight_kg: null,
                reps: 15,
                rpe: null
              }
            ]
          }
        ]
      };

      const result = flattenHevyWorkout(sparseResponse, "fallback_123");
      expect(result.workout_id).toBe("fallback_123");
      expect(result.rows[0].work_id).toBe("");
      expect(result.rows[0].title).toBe("Bodyweight Dips");
      expect(result.rows[0].weight_kg).toBeNull();
      expect(result.rows[0].rpe).toBeNull();
      expect(result.rows[0].reps).toBe(15);
      expect(result.rows[0].best_weight).toBeNull();
    });
  });
});
