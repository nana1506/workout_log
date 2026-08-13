/**
 * Recovery-Aware Exercise Substitution — purely deterministic, zero LLM calls.
 *
 * Given an unrecovered target muscle, finds alternative exercises that
 * hit fully-recovered muscles instead, without also hitting the target muscle.
 */

// Minimum secondary contribution to consider an exercise as "touching" a muscle
const SECONDARY_CONTRIBUTION_THRESHOLD = 0.2;

/**
 * Finds substitute exercises that target recovered muscles while avoiding
 * the unrecovered target muscle.
 *
 * @param {string} targetMuscle - the unrecovered muscle to avoid
 * @param {Map} muscleMapLookup - Map<exerciseTitle, [{muscle_group, role, contribution}]>
 * @param {Array} fullyRecoveredMuscles - array of { muscle, ... } objects (from musclePriorities.fullyRecovered)
 * @param {Array} exercisesList - array of { work_id, title, muscle_group } for exercises user has actually logged
 * @param {number} limit - max results to return (default 3)
 * @returns {Array<{ title: string, targetsMuscles: string[], viaRole: string }>}
 */
export function getSubstitutions(
  targetMuscle,
  muscleMapLookup,
  fullyRecoveredMuscles,
  exercisesList,
  limit = 3
) {
  if (!targetMuscle || !muscleMapLookup || muscleMapLookup.size === 0) return [];
  if (!fullyRecoveredMuscles || fullyRecoveredMuscles.length === 0) return [];

  const targetLower = targetMuscle.toLowerCase().trim();
  const recoveredSet = new Set(
    fullyRecoveredMuscles.map(m => (m.muscle || '').toLowerCase().trim())
  );

  // Build a set of exercise titles the user has actually logged (for preference ranking)
  const loggedTitlesSet = new Set(
    (exercisesList || []).map(e => (e.title || e.work_id || '').toLowerCase().trim())
  );

  // Iterate through all exercises in the muscle map
  const candidates = [];

  for (const [exerciseTitle, mappings] of muscleMapLookup.entries()) {
    // Check if this exercise touches the target muscle (disqualify it)
    const touchesTarget = mappings.some(m => {
      const mg = (m.muscle_group || '').toLowerCase().trim();
      if (mg !== targetLower) return false;
      // Primary always disqualifies
      if (m.role === 'primary') return true;
      // Secondary disqualifies only if contribution is above threshold
      return (m.contribution || 0) > SECONDARY_CONTRIBUTION_THRESHOLD;
    });

    if (touchesTarget) continue;

    // Check which recovered muscles this exercise hits as primary
    const recoveredHits = [];
    for (const m of mappings) {
      const mg = (m.muscle_group || '').toLowerCase().trim();
      if (m.role === 'primary' && recoveredSet.has(mg)) {
        recoveredHits.push(mg);
      }
    }

    // Only include exercises that hit at least one recovered muscle as primary
    if (recoveredHits.length === 0) continue;

    const titleLower = exerciseTitle.toLowerCase().trim();
    const isLogged = loggedTitlesSet.has(titleLower);

    candidates.push({
      title: exerciseTitle,
      targetsMuscles: recoveredHits,
      viaRole: 'primary',
      _isLogged: isLogged,
      _recoveredCount: recoveredHits.length,
    });
  }

  // Sort: logged exercises first, then by number of recovered muscles hit (descending)
  candidates.sort((a, b) => {
    if (a._isLogged !== b._isLogged) return a._isLogged ? -1 : 1;
    return b._recoveredCount - a._recoveredCount;
  });

  // Return top `limit`, stripping internal ranking fields
  return candidates.slice(0, limit).map(({ title, targetsMuscles, viaRole }) => ({
    title,
    targetsMuscles,
    viaRole,
  }));
}
