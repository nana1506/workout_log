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
 * Formats ISO date to "MMM DD" (e.g. "Aug 12")
 */
export function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      const dateKey = r.completed_at.slice(0, 10);
      if (!bySession[dateKey]) {
        bySession[dateKey] = { completed_at: r.completed_at, oneRms: [] };
      }
      bySession[dateKey].oneRms.push(calculated1RM);
    } else {
      const key = r.set_id ? r.set_id.split("-s")[0] : `${r.work_id || r.title}-${r.completed_at}`;
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
