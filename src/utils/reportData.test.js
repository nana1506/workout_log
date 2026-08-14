import { describe, it, expect } from "vitest";
import { buildReportPayload } from "./reportData.js";

describe("reportData", () => {
  const mockLogs = [
    { completed_at: "2026-08-10T10:00:00Z", title: "Bench Press", weight_kg: 100, reps: 5, rpe: 8, muscle_group: "chest" },
    { completed_at: "2026-08-10T10:05:00Z", title: "Bench Press", weight_kg: 105, reps: 5, rpe: 9, muscle_group: "chest" }, // PR (122.5 1RM)
    { completed_at: "2026-08-12T10:00:00Z", title: "Barbell Squat", weight_kg: 120, reps: 5, rpe: 8.5, muscle_group: "quadriceps" },
    { completed_at: "2026-08-14T10:00:00Z", title: "Barbell Row", weight_kg: 80, reps: 8, rpe: 7.5, muscle_group: "upper_back" },
  ];

  const priorLogs = [
    { completed_at: "2026-08-03T10:00:00Z", title: "Bench Press", weight_kg: 90, reps: 5, rpe: 8, muscle_group: "chest" },
    { completed_at: "2026-08-05T10:00:00Z", title: "Barbell Squat", weight_kg: 110, reps: 5, rpe: 8, muscle_group: "quadriceps" },
  ];

  const mockBodyMetrics = [
    { date: "2026-08-01", weight_kg: 78.5, muscle_mass_pct: 42.0, fat_mass_pct: 16.5 },
    { date: "2026-08-11", weight_kg: 78.0, muscle_mass_pct: 42.4, fat_mass_pct: 16.0 },
  ];

  const mockGoals = [
    { id: "g1", goal_type: "body_weight", target_label: "Target Weight", starting_value: 80, target_value: 77, status: "active" },
    { id: "g2", goal_type: "muscle_mass_pct", target_label: "Muscle %", starting_value: 41, target_value: 43, status: "active" },
  ];

  it("aggregates weekly volume, sessions, and PRs accurately", () => {
    const payload = buildReportPayload({
      rawLogs: mockLogs,
      bodyMetrics: mockBodyMetrics,
      trainingGoals: mockGoals,
      periodStart: "2026-08-10",
      periodEnd: "2026-08-16",
      priorPeriodLogs: priorLogs,
      periodType: "weekly",
    });

    expect(payload.periodType).toBe("weekly");
    expect(payload.periodStart).toBe("2026-08-10");
    expect(payload.periodEnd).toBe("2026-08-16");

    // Total volume: 100*5 + 105*5 + 120*5 + 80*8 = 500 + 525 + 600 + 640 = 2265
    expect(payload.summary.totalVolumeKg).toBe(2265);
    // Prior volume: 90*5 + 110*5 = 450 + 550 = 1000
    expect(payload.summary.priorVolumeKg).toBe(1000);
    expect(payload.summary.volumeDeltaPct).toBe(126.5);
    expect(payload.summary.sessionCount).toBe(3);
    expect(payload.summary.totalSets).toBe(4);

    // PRs: Bench press should have registered a PR
    expect(payload.prs.length).toBeGreaterThan(0);
    expect(payload.prs[0].exercise).toBe("Bench Press");

    // Body comp
    expect(payload.bodyComp).not.toBeNull();
    expect(payload.bodyComp.latestWeightKg).toBe(78.0);
    expect(payload.bodyComp.weightDeltaKg).toBe(-0.5);

    // Goals
    expect(payload.goals.length).toBe(2);
    expect(payload.goals[0].currentValue).toBe(78.0);
    expect(payload.goals[1].currentValue).toBe(42.4);
  });

  it("handles empty logs and missing scans gracefully", () => {
    const payload = buildReportPayload({
      rawLogs: [],
      bodyMetrics: [],
      trainingGoals: [],
      periodStart: "2026-08-10",
      periodEnd: "2026-08-16",
      priorPeriodLogs: [],
      periodType: "weekly",
    });

    expect(payload.summary.totalVolumeKg).toBe(0);
    expect(payload.summary.sessionCount).toBe(0);
    expect(payload.summary.volumeDeltaPct).toBeNull();
    expect(payload.prs).toEqual([]);
    expect(payload.plateaus).toEqual([]);
    expect(payload.injuryRisks).toEqual([]);
    expect(payload.bodyComp).toBeNull();
    expect(payload.goals).toEqual([]);
  });
});
