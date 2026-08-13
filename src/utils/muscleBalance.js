/**
 * Muscle Balance utilities — push/pull/anterior/posterior classification
 * and ratio computation from expandedStimulus data.
 *
 * This is intentionally separate from getTrainingSplit (Upper/Arms/Legs/Core)
 * and getRadarMuscleCategory (Back/Chest/Arm/Core/Legs) in calculations.js,
 * which categorize by body region. This module classifies by movement pattern
 * (push vs pull) and anterior/posterior chain.
 */

// ── Tunable thresholds ──────────────────────────────────────────────────
export const BALANCE_RATIO_CAUTION = 1.4;
export const BALANCE_RATIO_WARNING = 1.8;
export const NEGLECT_THRESHOLD_PCT = 0.10;

// ── Push / Pull / Legs classification ───────────────────────────────────
export const FUNCTIONAL_GROUPS = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['upper_back', 'lats', 'biceps'],
  legs_anterior: ['quadriceps'],
  legs_posterior: ['hamstrings', 'glutes'],
};

// Quick reverse-lookup: muscle → functional group key
const MUSCLE_TO_GROUP = {};
for (const [group, muscles] of Object.entries(FUNCTIONAL_GROUPS)) {
  for (const m of muscles) {
    MUSCLE_TO_GROUP[m] = group;
  }
}

// Paired groups for neglect detection
const PAIRED_GROUPS = [
  ['push', 'pull'],
  ['legs_anterior', 'legs_posterior'],
];

/**
 * Computes muscle-balance ratios and neglected muscles from expandedStimulus.
 *
 * @param {Array} expandedStimulus - output of expandLogsWithMuscleStimulus
 * @param {number} windowDays - trailing window in days (default 28)
 * @returns {{ pushPullRatio: number|null, quadHamstringRatio: number|null,
 *             neglectedMuscles: string[], windowDays: number,
 *             totalVolumeByMuscle: Record<string, number> }}
 */
export function computeMuscleBalance(expandedStimulus, windowDays = 28) {
  const result = {
    pushPullRatio: null,
    quadHamstringRatio: null,
    neglectedMuscles: [],
    windowDays,
    totalVolumeByMuscle: {},
  };

  if (!expandedStimulus || !expandedStimulus.length) return result;

  // Determine trailing-window cutoff
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // Filter to window and accumulate volume per muscle
  const volumeByMuscle = {};
  for (const ev of expandedStimulus) {
    if (!ev.completed_at || new Date(ev.completed_at) < cutoff) continue;
    const muscle = (ev.stimulus_muscle || '').toLowerCase().trim();
    if (!muscle) continue;
    volumeByMuscle[muscle] = (volumeByMuscle[muscle] || 0) + (ev.effectiveVolume || 0);
  }

  result.totalVolumeByMuscle = volumeByMuscle;

  // Sum volume per functional group
  const groupVolume = {};
  for (const group of Object.keys(FUNCTIONAL_GROUPS)) {
    groupVolume[group] = FUNCTIONAL_GROUPS[group].reduce(
      (sum, m) => sum + (volumeByMuscle[m] || 0),
      0
    );
  }

  // Push / Pull ratio
  if (groupVolume.push > 0 || groupVolume.pull > 0) {
    if (groupVolume.pull > 0) {
      result.pushPullRatio = Math.round((groupVolume.push / groupVolume.pull) * 100) / 100;
    } else if (groupVolume.push > 0) {
      // Push volume exists but zero pull → infinite imbalance, cap at a large sentinel
      result.pushPullRatio = Infinity;
    }
  }

  // Quad / Hamstring ratio
  if (groupVolume.legs_anterior > 0 || groupVolume.legs_posterior > 0) {
    if (groupVolume.legs_posterior > 0) {
      result.quadHamstringRatio = Math.round((groupVolume.legs_anterior / groupVolume.legs_posterior) * 100) / 100;
    } else if (groupVolume.legs_anterior > 0) {
      result.quadHamstringRatio = Infinity;
    }
  }

  // Neglected muscle detection
  for (const [groupA, groupB] of PAIRED_GROUPS) {
    const volA = groupVolume[groupA];
    const volB = groupVolume[groupB];

    if (volA > 0 && volB < volA * NEGLECT_THRESHOLD_PCT) {
      // groupB muscles are neglected relative to groupA
      for (const m of FUNCTIONAL_GROUPS[groupB]) {
        if ((volumeByMuscle[m] || 0) < volA * NEGLECT_THRESHOLD_PCT) {
          result.neglectedMuscles.push(m);
        }
      }
    }

    if (volB > 0 && volA < volB * NEGLECT_THRESHOLD_PCT) {
      // groupA muscles are neglected relative to groupB
      for (const m of FUNCTIONAL_GROUPS[groupA]) {
        if ((volumeByMuscle[m] || 0) < volB * NEGLECT_THRESHOLD_PCT) {
          result.neglectedMuscles.push(m);
        }
      }
    }
  }

  // Deduplicate neglected muscles
  result.neglectedMuscles = [...new Set(result.neglectedMuscles)];

  return result;
}
