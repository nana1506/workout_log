/**
 * Extracts clean workout ID from a raw ID string or full URL.
 * Handles inputs like:
 * - "c0a87588-433b-48ae-94a0-bfad1e8fa8ec"
 * - "https://hevy.com/workout/gR9V1s3a"
 * - "https://api.hevyapp.com/workout/gR9V1s3a?foo=bar"
 * - "https://hevy.com/workout/gR9V1s3a/"
 */
export function extractWorkoutId(input) {
  if (!input || typeof input !== "string") return "";
  let clean = input.trim();
  // Strip URL query params & hash
  clean = clean.split("?")[0].split("#")[0].replace(/\/+$/, "");
  // Extract trailing path component if it contains slashes
  if (clean.includes("/")) {
    const segments = clean.split("/").filter(Boolean);
    clean = segments[segments.length - 1] || "";
  }
  return clean.trim();
}

/**
 * Flattens Hevy API response JSON into an array of database rows matching Supabase `workout_log` schema.
 * 
 * Target Schema:
 * | Field Name   | Type   | Source |
 * | work_id      | String | exercises.id |
 * | title        | String | exercises.title |
 * | set_id       | String | exercises.sets.id |
 * | weight_kg    | Number | exercises.sets.weight_kg |
 * | rpe          | Number | exercises.sets.rpe |
 * | reps         | Number | exercises.sets.reps |
 * | index        | Number | exercises.sets.index |
 * | best_weight  | Number | exercises.sets.prs where type === 'best_weight' |
 * | best_volume  | Number | exercises.sets.prs where type === 'best_volume' |
 * | best_1rm     | Number | exercises.sets.prs where type === 'best_1rm' |
 * | muscle_group | String | exercises.muscle_group |
 * | completed_at | String | exercises.sets.completed_at |
 * | workout_id   | String | workout.short_id / fallback |
 * | inserted_at  | String | Current ISO timestamp |
 * 
 * @param {Object} hevyData - The raw JSON response from Hevy API
 * @param {string} [fallbackWorkoutId=""] - The workout ID used for the query if missing in response
 * @param {string} [insertedAt] - Optional fixed timestamp (useful for testing)
 * @returns {{ workout_id: string, workout_title: string, rows: Array<Object>, exercises_summary: Array<Object> }}
 */
export function flattenHevyWorkout(hevyData, fallbackWorkoutId = "", insertedAt = new Date().toISOString()) {
  if (!hevyData || typeof hevyData !== "object") {
    throw new Error("Invalid Hevy response payload: expected an object");
  }

  // Support response payloads formatted as { workout: { ... } }, { item: { json: { ... } } }, or direct root
  const workout = hevyData.workout || (hevyData.item && hevyData.item.json) || hevyData;

  const workoutShortId = String(
    workout.short_id ||
    hevyData.short_id ||
    (hevyData.item && hevyData.item.json && hevyData.item.json.short_id) ||
    workout.id ||
    fallbackWorkoutId ||
    ""
  );

  const workoutTitle = workout.title || workout.name || hevyData.title || "Workout";
  const workoutEndTime = workout.end_time || workout.start_time || hevyData.end_time || insertedAt;

  const exercises = Array.isArray(workout.exercises)
    ? workout.exercises
    : Array.isArray(hevyData.exercises)
    ? hevyData.exercises
    : [];

  const rows = [];
  const exercisesSummary = [];

  for (const exercise of exercises) {
    if (!exercise || typeof exercise !== "object") continue;

    const workId = String(exercise.id || exercise.exercise_template_id || "");
    const title = String(exercise.title || exercise.name || "");
    const muscleGroup = exercise.muscle_group || null;
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];

    exercisesSummary.push({
      work_id: workId,
      title,
      muscle_group: muscleGroup,
      sets_count: sets.length,
    });

    sets.forEach((set, setIdx) => {
      if (!set || typeof set !== "object") return;

      const setId = String(set.id != null ? set.id : `${workId}_${setIdx}`);
      const weightKg = set.weight_kg != null && !isNaN(Number(set.weight_kg))
        ? Number(set.weight_kg)
        : null;
      const rpe = set.rpe != null && !isNaN(Number(set.rpe))
        ? Number(set.rpe)
        : null;
      const reps = set.reps != null && !isNaN(Number(set.reps))
        ? Number(set.reps)
        : null;
      const index = set.index != null && !isNaN(Number(set.index))
        ? Number(set.index)
        : setIdx;

      // Extract PR values if available
      const prs = Array.isArray(set.prs) ? set.prs : [];
      const bestWeightItem = prs.find((p) => p && p.type === "best_weight");
      const bestVolumeItem = prs.find((p) => p && p.type === "best_volume");
      const best1rmItem = prs.find((p) => p && p.type === "best_1rm");

      const bestWeight = bestWeightItem && bestWeightItem.value != null && !isNaN(Number(bestWeightItem.value))
        ? Number(bestWeightItem.value)
        : null;
      const bestVolume = bestVolumeItem && bestVolumeItem.value != null && !isNaN(Number(bestVolumeItem.value))
        ? Number(bestVolumeItem.value)
        : null;
      const best1rm = best1rmItem && best1rmItem.value != null && !isNaN(Number(best1rmItem.value))
        ? Number(best1rmItem.value)
        : null;

      const completedAt = set.completed_at || exercise.completed_at || workoutEndTime;

      rows.push({
        work_id: workId,
        title,
        set_id: setId,
        weight_kg: weightKg,
        rpe,
        reps,
        index,
        best_weight: bestWeight,
        best_volume: bestVolume,
        best_1rm: best1rm,
        muscle_group: muscleGroup,
        completed_at: completedAt,
        workout_id: workoutShortId,
        inserted_at: insertedAt,
      });
    });
  }

  return {
    workout_id: workoutShortId,
    workout_title: workoutTitle,
    rows,
    exercises_summary: exercisesSummary,
  };
}
