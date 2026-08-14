/**
 * Utilities for server-side & client-side progress report data aggregation.
 * Pure functions with zero browser or React dependencies.
 */

import { buildOneRmSeries } from "./calculations.js";
import { detectPlateau, detectInjuryRisk } from "./analysis.js";
import { buildMuscleMapLookup, expandLogsWithMuscleStimulus } from "./muscleMap.js";
import { computeMuscleBalance } from "./muscleBalance.js";

/**
 * Builds a compact summary payload from raw database records for a given reporting period window.
 *
 * @param {Object} params
 * @param {Array} params.rawLogs - All raw workout_log records (or up to periodEnd)
 * @param {Array} [params.bodyMetrics=[]] - All body_metrics records
 * @param {Array} [params.trainingGoals=[]] - All training_goals records
 * @param {Map|Array} [params.muscleMapLookup] - Map or raw exercise_muscle_map rows
 * @param {string} params.periodStart - YYYY-MM-DD
 * @param {string} params.periodEnd - YYYY-MM-DD
 * @param {Array} [params.priorPeriodLogs=[]] - Raw workout_log records from preceding period
 * @param {string} [params.periodType='weekly'] - 'weekly' | 'monthly'
 * @returns {Object} Compact summary payload for Gemini and archiving
 */
export function buildReportPayload({
  rawLogs = [],
  bodyMetrics = [],
  trainingGoals = [],
  muscleMapLookup = null,
  periodStart,
  periodEnd,
  priorPeriodLogs = [],
  periodType = "weekly",
}) {
  if (!periodStart || !periodEnd) {
    throw new Error("periodStart and periodEnd are required");
  }

  // 1. Prepare Muscle Map Lookup
  const lookup =
    muscleMapLookup instanceof Map
      ? muscleMapLookup
      : Array.isArray(muscleMapLookup)
      ? buildMuscleMapLookup(muscleMapLookup)
      : null;

  // 2. Filter Workout Logs to Current Window & Pre-period History
  const periodLogs = (rawLogs || []).filter((r) => {
    const d = r.completed_at?.slice(0, 10);
    return d && d >= periodStart && d <= periodEnd;
  });

  const logsUpToPeriodEnd = (rawLogs || []).filter((r) => {
    const d = r.completed_at?.slice(0, 10);
    return d && d <= periodEnd;
  });

  // Prior period logs
  const priorLogs = Array.isArray(priorPeriodLogs) && priorPeriodLogs.length > 0
    ? priorPeriodLogs
    : [];

  // 3. Volume & Sessions
  const totalVolume = periodLogs.reduce((sum, r) => sum + (Number(r.weight_kg) || 0) * (Number(r.reps) || 0), 0);
  const priorVolume = priorLogs.reduce((sum, r) => sum + (Number(r.weight_kg) || 0) * (Number(r.reps) || 0), 0);
  const volumeDeltaPct = priorVolume > 0
    ? Math.round(((totalVolume - priorVolume) / priorVolume) * 1000) / 10
    : null;

  const sessionDates = [...new Set(periodLogs.map((r) => r.completed_at?.slice(0, 10)).filter(Boolean))];
  const priorSessionDates = [...new Set(priorLogs.map((r) => r.completed_at?.slice(0, 10)).filter(Boolean))];
  const sessionCount = sessionDates.length;
  const priorSessionCount = priorSessionDates.length;

  // Average RPE in period
  const logsWithRpe = periodLogs.filter((r) => r.rpe != null && !isNaN(r.rpe));
  const avgRpe = logsWithRpe.length > 0
    ? Math.round((logsWithRpe.reduce((sum, r) => sum + Number(r.rpe), 0) / logsWithRpe.length) * 10) / 10
    : null;

  // Total Sets
  const totalSets = periodLogs.length;

  // 4. PRs in Window
  // Group all logs up to periodEnd by exercise
  const exercisesTouched = [...new Set(periodLogs.map((r) => r.title || r.work_id).filter(Boolean))];
  const logsByExercise = {};
  logsUpToPeriodEnd.forEach((r) => {
    const key = r.title || r.work_id;
    if (!key) return;
    if (!logsByExercise[key]) logsByExercise[key] = [];
    logsByExercise[key].push(r);
  });

  const prsInWindow = [];
  const plateauList = [];
  const injuryRisks = [];

  for (const exerciseTitle of exercisesTouched) {
    const exLogs = logsByExercise[exerciseTitle] || [];
    if (exLogs.length === 0) continue;

    // 1RM Series calculation
    const series = buildOneRmSeries(exLogs, false);
    
    // Find PRs achieved in this period window
    series.forEach((point) => {
      const pointDate = point.rawDate?.slice(0, 10);
      if (point.isPR && pointDate && pointDate >= periodStart && pointDate <= periodEnd) {
        prsInWindow.push({
          exercise: exerciseTitle,
          date: pointDate,
          oneRm: point.oneRm,
        });
      }
    });

    // Plateau Detection for this exercise
    const plateau = detectPlateau(series, 5, 0.01);
    if (plateau.isPlateaued) {
      plateauList.push({
        exercise: exerciseTitle,
        sessionsFlat: plateau.sessionsFlat,
        sinceDate: plateau.sinceDate,
      });
    }

    // Injury Risk Detection
    const risk = detectInjuryRisk(exLogs);
    if (risk.level && risk.level !== "none") {
      injuryRisks.push({
        exercise: exerciseTitle,
        level: risk.level,
        reason: risk.reason,
      });
    }
  }

  // 5. Muscle Balance & Stimulus
  const stimulusEvents = expandLogsWithMuscleStimulus(periodLogs, lookup);
  const muscleBalance = computeMuscleBalance(stimulusEvents, periodType === "monthly" ? 31 : 7);

  // Top targeted muscles in period
  const sortedMuscles = Object.entries(muscleBalance.totalVolumeByMuscle || {})
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, volume]) => ({ muscle, volume: Math.round(volume) }));

  // 6. Body Composition Changes
  const metricsInWindow = (bodyMetrics || [])
    .filter((m) => {
      const d = m.date?.slice(0, 10);
      return d && d >= periodStart && d <= periodEnd;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let bodyComp = null;
  if (metricsInWindow.length > 0) {
    const latest = metricsInWindow[metricsInWindow.length - 1];
    // Look for baseline before window or use the first scan of the window
    const priorMetric = (bodyMetrics || [])
      .filter((m) => m.date?.slice(0, 10) < periodStart)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const baseline = metricsInWindow.length > 1 ? metricsInWindow[0] : (priorMetric || latest);

    const latestWeight = latest.weight_kg != null ? Number(latest.weight_kg) : null;
    const baselineWeight = baseline?.weight_kg != null ? Number(baseline.weight_kg) : null;
    const weightDelta = latestWeight != null && baselineWeight != null
      ? Math.round((latestWeight - baselineWeight) * 10) / 10
      : 0;

    const latestMusclePct = latest.muscle_mass_pct != null ? Number(latest.muscle_mass_pct) : null;
    const baselineMusclePct = baseline?.muscle_mass_pct != null ? Number(baseline.muscle_mass_pct) : null;
    const muscleMassPctDelta = latestMusclePct != null && baselineMusclePct != null
      ? Math.round((latestMusclePct - baselineMusclePct) * 10) / 10
      : 0;

    const latestFatPct = latest.fat_mass_pct != null ? Number(latest.fat_mass_pct) : null;
    const baselineFatPct = baseline?.fat_mass_pct != null ? Number(baseline.fat_mass_pct) : null;
    const fatMassPctDelta = latestFatPct != null && baselineFatPct != null
      ? Math.round((latestFatPct - baselineFatPct) * 10) / 10
      : 0;

    bodyComp = {
      scansCount: metricsInWindow.length,
      latestDate: latest.date?.slice(0, 10),
      latestWeightKg: latestWeight,
      weightDeltaKg: weightDelta,
      latestMuscleMassPct: latestMusclePct,
      muscleMassPctDelta,
      latestFatMassPct: latestFatPct,
      fatMassPctDelta,
    };
  }

  // 7. Training Goals Progress
  const activeGoals = (trainingGoals || []).filter((g) => g.status === "active" || g.status === "achieved");
  const latestMetricOverall = (bodyMetrics || []).sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const goalsProgress = activeGoals.map((g) => {
    let currentValue = null;
    if (g.goal_type === "body_weight") {
      currentValue = bodyComp?.latestWeightKg ?? (latestMetricOverall?.weight_kg != null ? Number(latestMetricOverall.weight_kg) : null);
    } else if (g.goal_type === "muscle_mass_pct") {
      currentValue = bodyComp?.latestMuscleMassPct ?? (latestMetricOverall?.muscle_mass_pct != null ? Number(latestMetricOverall.muscle_mass_pct) : null);
    }

    const targetVal = Number(g.target_value) || 0;
    const startVal = Number(g.starting_value) || currentValue || 0;
    let pctComplete = null;
    if (currentValue != null && targetVal !== startVal) {
      pctComplete = Math.min(100, Math.max(0, Math.round(((currentValue - startVal) / (targetVal - startVal)) * 100)));
    }

    return {
      id: g.id,
      goalType: g.goal_type,
      targetLabel: g.target_label || (g.goal_type === "body_weight" ? "Body Weight" : "Muscle Mass %"),
      startingValue: g.starting_value != null ? Number(g.starting_value) : null,
      currentValue,
      targetValue: targetVal,
      targetDate: g.target_date || null,
      status: g.status,
      pctComplete,
    };
  });

  return {
    periodType,
    periodStart,
    periodEnd,
    generatedAt: new Date().toISOString(),
    summary: {
      totalVolumeKg: Math.round(totalVolume),
      priorVolumeKg: Math.round(priorVolume),
      volumeDeltaPct,
      sessionCount,
      priorSessionCount,
      totalSets,
      avgRpe,
    },
    prs: prsInWindow,
    plateaus: plateauList,
    injuryRisks,
    muscleBalance: {
      pushPullRatio: muscleBalance.pushPullRatio,
      quadHamstringRatio: muscleBalance.quadHamstringRatio,
      neglectedMuscles: muscleBalance.neglectedMuscles,
      topMuscles: sortedMuscles.slice(0, 5),
    },
    bodyComp,
    goals: goalsProgress,
  };
}
