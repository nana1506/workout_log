/**
 * Normalizes an exercise title key for robust case-insensitive and whitespace-tolerant matching.
 */
export function normalizeExerciseKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key
    .toLowerCase()
    .trim()
    .replace(/[_\s-]+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Normalizes a muscle group identifier to standard lowercase underscore format.
 */
export function normalizeMuscleGroup(muscle) {
  if (!muscle || typeof muscle !== 'string') return 'general';
  const clean = muscle.toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (clean === 'abs' || clean === 'core') return 'abdominals';
  if (clean === 'deltoids' || clean === 'delt' || clean === 'delts') return 'shoulders';
  if (clean === 'pecs') return 'chest';
  if (clean === 'quads') return 'quadriceps';
  if (clean === 'back') return 'upper_back';
  return clean;
}

/**
 * Built-in standard exercise muscle database for automatic classification.
 */
export const DEFAULT_EXERCISE_MUSCLE_MAP = new Map([
  // Traps / Upper Back
  ['shrug', [{ muscle_group: 'traps', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['dumbbell shrug', [{ muscle_group: 'traps', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['shrug dumbbell', [{ muscle_group: 'traps', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['shrug dumble', [{ muscle_group: 'traps', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['shrug dumbel', [{ muscle_group: 'traps', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['barbell shrug', [{ muscle_group: 'traps', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['smith machine shrug', [{ muscle_group: 'traps', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['cable shrug', [{ muscle_group: 'traps', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['face pull', [{ muscle_group: 'upper_back', role: 'primary', contribution: 1.0 }, { muscle_group: 'traps', role: 'secondary', contribution: 0.4 }, { muscle_group: 'shoulders', role: 'secondary', contribution: 0.3 }]],

  // Chest
  ['bench press', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }, { muscle_group: 'shoulders', role: 'secondary', contribution: 0.2 }]],
  ['dumbbell bench press', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }, { muscle_group: 'shoulders', role: 'secondary', contribution: 0.2 }]],
  ['incline bench press', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }, { muscle_group: 'shoulders', role: 'secondary', contribution: 0.3 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }]],
  ['incline dumbbell press', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }, { muscle_group: 'shoulders', role: 'secondary', contribution: 0.3 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }]],
  ['chest press', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }]],
  ['push up', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }]],
  ['chest fly', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }]],
  ['pec deck', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }]],
  ['dips', [{ muscle_group: 'chest', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.4 }]],

  // Shoulders
  ['overhead press', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }]],
  ['shoulder press', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }]],
  ['dumbbell shoulder press', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }]],
  ['military press', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }, { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }]],
  ['lateral raise', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }]],
  ['dumbbell lateral raise', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }]],
  ['cable lateral raise', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }]],
  ['front raise', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }]],
  ['rear delt fly', [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],

  // Back / Lats
  ['lat pulldown', [{ muscle_group: 'lats', role: 'primary', contribution: 1.0 }, { muscle_group: 'biceps', role: 'secondary', contribution: 0.3 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['pull up', [{ muscle_group: 'lats', role: 'primary', contribution: 1.0 }, { muscle_group: 'biceps', role: 'secondary', contribution: 0.3 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }]],
  ['chin up', [{ muscle_group: 'lats', role: 'primary', contribution: 1.0 }, { muscle_group: 'biceps', role: 'secondary', contribution: 0.4 }]],
  ['seated cable row', [{ muscle_group: 'upper_back', role: 'primary', contribution: 1.0 }, { muscle_group: 'lats', role: 'secondary', contribution: 0.4 }, { muscle_group: 'biceps', role: 'secondary', contribution: 0.3 }]],
  ['barbell row', [{ muscle_group: 'upper_back', role: 'primary', contribution: 1.0 }, { muscle_group: 'lats', role: 'secondary', contribution: 0.4 }, { muscle_group: 'biceps', role: 'secondary', contribution: 0.3 }]],
  ['dumbbell row', [{ muscle_group: 'lats', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.4 }, { muscle_group: 'biceps', role: 'secondary', contribution: 0.3 }]],
  ['t bar row', [{ muscle_group: 'upper_back', role: 'primary', contribution: 1.0 }, { muscle_group: 'lats', role: 'secondary', contribution: 0.4 }]],

  // Legs
  ['squat', [{ muscle_group: 'quadriceps', role: 'primary', contribution: 1.0 }, { muscle_group: 'glutes', role: 'secondary', contribution: 0.4 }]],
  ['barbell squat', [{ muscle_group: 'quadriceps', role: 'primary', contribution: 1.0 }, { muscle_group: 'glutes', role: 'secondary', contribution: 0.4 }]],
  ['leg press', [{ muscle_group: 'quadriceps', role: 'primary', contribution: 1.0 }, { muscle_group: 'glutes', role: 'secondary', contribution: 0.3 }]],
  ['leg extension', [{ muscle_group: 'quadriceps', role: 'primary', contribution: 1.0 }]],
  ['deadlift', [{ muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 }, { muscle_group: 'upper_back', role: 'secondary', contribution: 0.4 }, { muscle_group: 'traps', role: 'secondary', contribution: 0.3 }, { muscle_group: 'glutes', role: 'secondary', contribution: 0.4 }]],
  ['romanian deadlift', [{ muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 }, { muscle_group: 'glutes', role: 'secondary', contribution: 0.4 }]],
  ['rdl', [{ muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 }, { muscle_group: 'glutes', role: 'secondary', contribution: 0.4 }]],
  ['leg curl', [{ muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 }]],
  ['lying leg curl', [{ muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 }]],
  ['seated leg curl', [{ muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 }]],
  ['calf raise', [{ muscle_group: 'calves', role: 'primary', contribution: 1.0 }]],
  ['standing calf raise', [{ muscle_group: 'calves', role: 'primary', contribution: 1.0 }]],
  ['seated calf raise', [{ muscle_group: 'calves', role: 'primary', contribution: 1.0 }]],

  // Arms
  ['bicep curl', [{ muscle_group: 'biceps', role: 'primary', contribution: 1.0 }, { muscle_group: 'forearms', role: 'secondary', contribution: 0.2 }]],
  ['dumbbell curl', [{ muscle_group: 'biceps', role: 'primary', contribution: 1.0 }, { muscle_group: 'forearms', role: 'secondary', contribution: 0.2 }]],
  ['barbell curl', [{ muscle_group: 'biceps', role: 'primary', contribution: 1.0 }, { muscle_group: 'forearms', role: 'secondary', contribution: 0.2 }]],
  ['hammer curl', [{ muscle_group: 'biceps', role: 'primary', contribution: 1.0 }, { muscle_group: 'forearms', role: 'secondary', contribution: 0.4 }]],
  ['preacher curl', [{ muscle_group: 'biceps', role: 'primary', contribution: 1.0 }]],
  ['tricep pushdown', [{ muscle_group: 'triceps', role: 'primary', contribution: 1.0 }]],
  ['tricep extension', [{ muscle_group: 'triceps', role: 'primary', contribution: 1.0 }]],
  ['skull crusher', [{ muscle_group: 'triceps', role: 'primary', contribution: 1.0 }]],
  ['cable tricep pushdown', [{ muscle_group: 'triceps', role: 'primary', contribution: 1.0 }]],

  // Core
  ['ab crunch', [{ muscle_group: 'abdominals', role: 'primary', contribution: 1.0 }]],
  ['cable crunch', [{ muscle_group: 'abdominals', role: 'primary', contribution: 1.0 }]],
  ['hanging leg raise', [{ muscle_group: 'abdominals', role: 'primary', contribution: 1.0 }]],
  ['plank', [{ muscle_group: 'abdominals', role: 'primary', contribution: 1.0 }]],
]);

/**
 * Intelligent keyword-based heuristic matcher for unmapped exercises.
 */
export function matchHeuristicMuscles(title) {
  if (!title || typeof title !== 'string') return null;
  const t = title.toLowerCase();

  if (t.includes('shrug')) {
    return [
      { muscle_group: 'traps', role: 'primary', contribution: 1.0 },
      { muscle_group: 'upper_back', role: 'secondary', contribution: 0.3 }
    ];
  }
  if (t.includes('lateral raise') || t.includes('side raise') || t.includes('overhead press') || t.includes('shoulder press') || t.includes('military press') || t.includes('arnold press') || t.includes('rear delt') || t.includes('deltoid')) {
    return [{ muscle_group: 'shoulders', role: 'primary', contribution: 1.0 }];
  }
  if (t.includes('bench press') || t.includes('chest press') || t.includes('chest fly') || t.includes('pec deck') || t.includes('push up') || t.includes('dip')) {
    return [
      { muscle_group: 'chest', role: 'primary', contribution: 1.0 },
      { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 }
    ];
  }
  if (t.includes('face pull')) {
    return [
      { muscle_group: 'upper_back', role: 'primary', contribution: 1.0 },
      { muscle_group: 'traps', role: 'secondary', contribution: 0.4 },
      { muscle_group: 'shoulders', role: 'secondary', contribution: 0.3 }
    ];
  }
  if (t.includes('lat pulldown') || t.includes('pull up') || t.includes('chin up') || t.includes('pulldown') || t.includes('row')) {
    return [
      { muscle_group: 'lats', role: 'primary', contribution: 1.0 },
      { muscle_group: 'upper_back', role: 'secondary', contribution: 0.4 },
      { muscle_group: 'biceps', role: 'secondary', contribution: 0.3 }
    ];
  }
  if (t.includes('deadlift') || t.includes('rdl')) {
    return [
      { muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 },
      { muscle_group: 'upper_back', role: 'secondary', contribution: 0.4 },
      { muscle_group: 'traps', role: 'secondary', contribution: 0.3 }
    ];
  }
  if (t.includes('squat') || t.includes('leg press') || t.includes('hack squat') || t.includes('lunge') || t.includes('quad') || t.includes('leg ext')) {
    return [{ muscle_group: 'quadriceps', role: 'primary', contribution: 1.0 }];
  }
  if (t.includes('leg curl') || t.includes('hamstring')) {
    return [{ muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 }];
  }
  if (t.includes('bicep') || t.includes('curl') || t.includes('hammer')) {
    return [{ muscle_group: 'biceps', role: 'primary', contribution: 1.0 }];
  }
  if (t.includes('tricep') || t.includes('pushdown') || t.includes('skull crusher') || t.includes('kickback')) {
    return [{ muscle_group: 'triceps', role: 'primary', contribution: 1.0 }];
  }
  if (t.includes('calf') || t.includes('calves')) {
    return [{ muscle_group: 'calves', role: 'primary', contribution: 1.0 }];
  }
  if (t.includes('crunch') || t.includes('plank') || t.includes('abdom') || t.includes('sit up') || t.includes('abs')) {
    return [{ muscle_group: 'abdominals', role: 'primary', contribution: 1.0 }];
  }

  return null;
}

/**
 * Builds a lookup Map from raw exercise_muscle_map database rows.
 * Stores both exact and normalized keys for robust retrieval.
 */
export function buildMuscleMapLookup(rows) {
  const map = new Map();
  if (!rows || !Array.isArray(rows)) return map;

  for (const row of rows) {
    if (!row.exercise_key) continue;
    const rawKey = row.exercise_key;
    const normKey = normalizeExerciseKey(rawKey);
    const entry = {
      muscle_group: normalizeMuscleGroup(row.muscle_group),
      role: row.role || 'primary',
      contribution: row.contribution != null ? Number(row.contribution) : 1.0
    };

    if (!map.has(rawKey)) map.set(rawKey, []);
    map.get(rawKey).push(entry);

    if (normKey && normKey !== rawKey) {
      if (!map.has(normKey)) map.set(normKey, []);
      map.get(normKey).push(entry);
    }
  }
  return map;
}

/**
 * Returns the muscle mapping entries for a given exercise title.
 * Checks:
 * 1. Custom DB lookup (exact & normalized)
 * 2. Default built-in exercise database
 * 3. Intelligent keyword heuristics
 * 4. Fallback primary muscle group from log row
 */
export function getMusclesForExercise(title, lookup, fallbackPrimary) {
  if (title) {
    // 1. Custom DB lookup
    if (lookup && lookup.has(title)) {
      return lookup.get(title);
    }
    const normKey = normalizeExerciseKey(title);
    if (lookup && normKey && lookup.has(normKey)) {
      return lookup.get(normKey);
    }

    // 2. Built-in defaults
    if (DEFAULT_EXERCISE_MUSCLE_MAP.has(normKey)) {
      return DEFAULT_EXERCISE_MUSCLE_MAP.get(normKey);
    }

    // 3. Keyword heuristics
    const heuristic = matchHeuristicMuscles(title);
    if (heuristic) {
      return heuristic;
    }
  }

  // 4. Fallback from log row
  const fallbackMuscle = normalizeMuscleGroup(fallbackPrimary || 'general');
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
        stimulus_muscle: normalizeMuscleGroup(muscleEntry.muscle_group),
        role: muscleEntry.role,
        contribution: muscleEntry.contribution,
        effectiveVolume: (Number(log.weight_kg) || 0) * (Number(log.reps) || 0) * (muscleEntry.contribution || 1.0)
      });
    }
  }
  return stimulusEvents;
}

