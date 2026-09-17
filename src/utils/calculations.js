/**
 * Estimates 1 Rep Max using Epley formula
 */
export function estOneRM(weight, reps) {
  if (!weight || !reps) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * Calculates linear regression slope for progress trending
 */
export function linregSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Formats an ISO timestamp or Date object into a YYYY-MM-DD date string
 * in the Asia/Jakarta (WIB, UTC+7) timezone.
 */
export function toLocalDateStr(iso, timeZone = "Asia/Jakarta") {
  if (!iso) return "";
  if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso;
  }
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return typeof iso === "string" ? iso.slice(0, 10) : "";
    }
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d);
  } catch {
    return typeof iso === "string" ? iso.slice(0, 10) : "";
  }
}

/**
 * Formats ISO date to "MMM DD" (e.g. "Aug 12") in WIB (Asia/Jakarta)
 */
export function fmtDate(iso, timeZone = "Asia/Jakarta") {
  if (!iso) return "";
  try {
    const d = typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(`${iso}T12:00:00Z`)
      : new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Returns ACWR Zone labels and corresponding color codes
 */
export function acwrZone(v) {
  if (v < 0.8) return { label: "Low stimulus", color: "#7FA6FF" };
  if (v <= 1.3) return { label: "Sweet spot", color: "#4FD1C5" };
  if (v <= 1.5) return { label: "Caution", color: "#F4B740" };
  return { label: "High risk", color: "#EF7B57" };
}

/**
 * Maps muscle group to training split labels (Upper, Arms, Legs, Core, Full Body)
 */
export function getTrainingSplit(muscleGroup) {
  if (!muscleGroup) return { split: "Other", detail: "General" };
  const m = muscleGroup.toLowerCase().trim();
  
  if (["chest", "pecs", "lats", "upper_back", "back", "shoulders", "deltoids", "traps"].includes(m)) {
    return { split: "Upper", detail: muscleGroup };
  }
  if (["biceps", "triceps", "forearms", "arm", "arms"].includes(m)) {
    return { split: "Arms", detail: muscleGroup };
  }
  if (["quadriceps", "quads", "hamstrings", "glutes", "legs", "calves", "abductors", "adductors"].includes(m)) {
    return { split: "Legs", detail: muscleGroup };
  }
  if (["abdominals", "abs", "core"].includes(m)) {
    return { split: "Core", detail: muscleGroup };
  }
  if (["full_body"].includes(m)) {
    return { split: "Full Body", detail: muscleGroup };
  }
  return { split: "Other", detail: muscleGroup };
}

/**
 * Maps muscle group to radar categories (Back, Chest, Arm, Core, Legs)
 */
export function getRadarMuscleCategory(muscleGroup) {
  if (!muscleGroup) return "Other";
  const m = muscleGroup.toLowerCase().trim();
  
  if (["back", "lats", "upper_back", "traps"].includes(m)) {
    return "Back";
  }
  if (["chest", "pecs"].includes(m)) {
    return "Chest";
  }
  if (["biceps", "triceps", "forearms", "shoulders", "deltoids", "arm", "arms"].includes(m)) {
    return "Arm";
  }
  if (["abdominals", "abs", "core"].includes(m)) {
    return "Core";
  }
  if (["quadriceps", "quads", "hamstrings", "glutes", "legs", "calves", "abductors", "adductors"].includes(m)) {
    return "Legs";
  }
  return "Other";
}

/**
 * Builds 1RM time-series logs
 */
export function buildOneRmSeries(rows, isAllExercises = false) {
  const bySession = {};
  rows.forEach((r) => {
    const calculated1RM = r.best_1rm || estOneRM(r.weight_kg, r.reps);
    if (isAllExercises) {
      const dateKey = toLocalDateStr(r.completed_at);
      if (!bySession[dateKey]) {
        bySession[dateKey] = { completed_at: r.completed_at, oneRms: [] };
      }
      bySession[dateKey].oneRms.push(calculated1RM);
    } else {
      const key = r.set_id ? r.set_id.split("-s")[0] : `${r.work_id || r.title}-${toLocalDateStr(r.completed_at)}`;
      if (!bySession[key] || calculated1RM > (bySession[key]._calc1RM || 0)) {
        bySession[key] = { ...r, _calc1RM: calculated1RM };
      }
    }
  });

  const sorted = Object.values(bySession).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
  let runningMax = 0;
  return sorted.map((item) => {
    if (isAllExercises) {
      const avg1Rm = Math.round((item.oneRms.reduce((sum, val) => sum + val, 0) / item.oneRms.length) * 10) / 10;
      const isPR = avg1Rm > runningMax;
      if (isPR) runningMax = avg1Rm;
      return { rawDate: item.completed_at, date: fmtDate(item.completed_at), oneRm: avg1Rm, isPR };
    } else {
      const isPR = item._calc1RM > runningMax;
      if (isPR) runningMax = item._calc1RM;
      return { rawDate: item.completed_at, date: fmtDate(item.completed_at), oneRm: item._calc1RM, isPR, weekIndex: item._weekIndex };
    }
  });
}

/**
 * Computes historical slope (change per day) using linear regression
 * @param {Array} dataPoints - Array of { date, value }
 */
export function getHistorySlope(dataPoints) {
  const points = dataPoints
    .filter(p => p.date && p.value !== null && p.value !== undefined)
    .map(p => ({
      x: new Date(p.date).getTime() / (1000 * 60 * 60 * 24), // unit: days
      y: Number(p.value)
    }))
    .sort((a, b) => a.x - b.x);
  
  if (points.length < 2) return 0;
  return linregSlope(points);
}

/**
 * Extracts a consistent session key from a log row.
 * Prefers the set_id session prefix (e.g. 'workout_123-s1' -> 'workout_123'),
 * falling back to the YYYY-MM-DD date string in WIB (Asia/Jakarta).
 */
export function getSessionKey(row) {
  if (!row) return "";
  if (row.set_id) {
    return row.set_id.split("-s")[0];
  }
  return toLocalDateStr(row.completed_at);
}

/**
 * Counts the number of distinct workout sessions in a list of log rows.
 */
export function countSessions(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const uniqueSessionKeys = new Set(rows.map(getSessionKey).filter(Boolean));
  return uniqueSessionKeys.size;
}

/**
 * Counts total sets in a list of log rows.
 * Each valid row in the workout_log table represents 1 set.
 */
export function countSets(rows = []) {
  if (!Array.isArray(rows)) return 0;
  return rows.length;
}

/**
 * Counts total repetitions across a list of log rows.
 */
export function countReps(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  return rows.reduce((sum, r) => sum + (Number(r.reps) || 0), 0);
}

/**
 * Calculates total workload volume in kg (weight_kg * reps) across log rows.
 */
export function calcVolume(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  return rows.reduce((sum, r) => sum + (Number(r.weight_kg) || 0) * (Number(r.reps) || 0), 0);
}

/**
 * Builds dual-axis session time-series with both total Volume (kg) and average RPE.
 */
export function buildVolumeRpeSeries(rows = [], cutoff = new Date(0)) {
  if (!Array.isArray(rows)) return [];
  const bySession = {};

  const logsInRange = rows.filter(r => r.completed_at && new Date(r.completed_at) >= cutoff);

  logsInRange.forEach((r) => {
    const key = toLocalDateStr(r.completed_at);
    if (!bySession[key]) {
      bySession[key] = {
        key,
        date: fmtDate(r.completed_at),
        rawDate: r.completed_at,
        volume: 0,
        rpeSum: 0,
        rpeCount: 0,
        sets: 0,
        weights: [],
      };
    }
    const setVolume = (Number(r.weight_kg) || 0) * (Number(r.reps) || 0);
    bySession[key].volume += setVolume;
    bySession[key].sets += 1;
    if (r.weight_kg) bySession[key].weights.push(Number(r.weight_kg));
    if (r.rpe != null && !isNaN(r.rpe) && Number(r.rpe) > 0) {
      bySession[key].rpeSum += Number(r.rpe);
      bySession[key].rpeCount += 1;
    }
  });

  return Object.values(bySession)
    .sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate))
    .map((s) => {
      const avgRpe = s.rpeCount > 0 ? Math.round((s.rpeSum / s.rpeCount) * 10) / 10 : 7.0;
      const avgWeight = s.weights.length ? Math.round(s.weights.reduce((a, b) => a + b, 0) / s.weights.length) : 0;
      return {
        key: s.key,
        date: s.date,
        rawDate: s.rawDate,
        volume: Math.round(s.volume),
        rpe: avgRpe,
        sets: s.sets,
        avgWeight,
        isRpeSpike: avgRpe >= 8.5
      };
    });
}

/**
 * Aggregates working sets into 3 RPE intensity distribution buckets:
 * - Light / Warmup (RPE < 7.0)
 * - Hypertrophy / Moderate (RPE 7.0 - 8.5)
 * - High Strain / Peak (RPE > 8.5)
 */
export function computeRpeDistribution(rows = []) {
  const defaultBuckets = [
    { name: "Light / Warmup", key: "light", range: "< 7.0", count: 0, pct: 0, volume: 0, avgWeight: 0, color: "#4FD1C5" },
    { name: "Hypertrophy / Moderate", key: "moderate", range: "7.0 - 8.5", count: 0, pct: 0, volume: 0, avgWeight: 0, color: "#F4B740" },
    { name: "High Strain / Peak", key: "high", range: "> 8.5", count: 0, pct: 0, volume: 0, avgWeight: 0, color: "#EF7B57" }
  ];

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalSets: 0,
      totalVolume: 0,
      buckets: defaultBuckets
    };
  }

  const bucketsMap = {
    light: { name: "Light / Warmup", key: "light", range: "< 7.0", count: 0, volume: 0, weightSum: 0, color: "#4FD1C5" },
    moderate: { name: "Hypertrophy / Moderate", key: "moderate", range: "7.0 - 8.5", count: 0, volume: 0, weightSum: 0, color: "#F4B740" },
    high: { name: "High Strain / Peak", key: "high", range: "> 8.5", count: 0, volume: 0, weightSum: 0, color: "#EF7B57" }
  };

  let totalSets = 0;
  let totalVolume = 0;

  for (const r of rows) {
    totalSets += 1;
    const rpe = Number(r.rpe);
    const setVol = (Number(r.weight_kg) || 0) * (Number(r.reps) || 0);
    const weight = Number(r.weight_kg) || 0;
    totalVolume += setVol;

    if (!rpe || isNaN(rpe) || rpe < 7.0) {
      bucketsMap.light.count += 1;
      bucketsMap.light.volume += setVol;
      bucketsMap.light.weightSum += weight;
    } else if (rpe <= 8.5) {
      bucketsMap.moderate.count += 1;
      bucketsMap.moderate.volume += setVol;
      bucketsMap.moderate.weightSum += weight;
    } else {
      bucketsMap.high.count += 1;
      bucketsMap.high.volume += setVol;
      bucketsMap.high.weightSum += weight;
    }
  }

  const buckets = Object.values(bucketsMap).map(b => ({
    ...b,
    volume: Math.round(b.volume),
    pct: totalSets > 0 ? Math.round((b.count / totalSets) * 100) : 0,
    avgWeight: b.count > 0 ? Math.round(b.weightSum / b.count) : 0
  }));

  return {
    totalSets,
    totalVolume: Math.round(totalVolume),
    buckets
  };
}

