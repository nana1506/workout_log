/**
 * Builds a lookup Map from raw exercise_muscle_map database rows.
 * Key: exercise_key (exact title match)
 * Value: array of { muscle_group, role, contribution }
 */
export function buildMuscleMapLookup(rows) {
  const map = new Map();
  if (!rows || !Array.isArray(rows)) return map;

  for (const row of rows) {
    if (!row.exercise_key) continue;
    const key = row.exercise_key;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push({
      muscle_group: row.muscle_group,
      role: row.role,
      contribution: row.contribution != null ? Number(row.contribution) : 1.0
    });
  }
  return map;
}

/**
 * Returns the muscle mapping entries for a given exercise title.
 * Fallbacks to a single-entry primary muscle mapping if not found in the lookup.
 */
export function getMusclesForExercise(title, lookup, fallbackPrimary) {
  if (lookup && title && lookup.has(title)) {
    return lookup.get(title);
  }
  // If fallbackPrimary is not defined/null, use a generic default like 'chest' or keep it null
  const fallbackMuscle = fallbackPrimary || 'general';
  return [{ muscle_group: fallbackMuscle, role: 'primary', contribution: 1.0 }];
}

/**
 * Expands raw workout logs into individual muscle stimulus events.
 * A single set with secondary muscles expands to multiple stimulus events.
 */
export function expandLogsWithMuscleStimulus(rawLogs, lookup) {
  const stimulusEvents = [];
  if (!rawLogs || !Array.isArray(rawLogs)) return stimulusEvents;

  for (const log of rawLogs) {
    const muscles = getMusclesForExercise(log.title || log.work_id, lookup, log.muscle_group);
    for (const muscleEntry of muscles) {
      stimulusEvents.push({
        ...log,
        stimulus_muscle: muscleEntry.muscle_group,
        role: muscleEntry.role,
        contribution: muscleEntry.contribution,
        effectiveVolume: (log.weight_kg ?? 0) * (log.reps ?? 0) * muscleEntry.contribution
      });
    }
  }
  return stimulusEvents;
}
