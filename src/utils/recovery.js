export const MUSCLE_RECOVERY_HOURS = {
  // Small muscles (recover faster ~24-36h)
  biceps: 24,
  triceps: 24,
  forearms: 24,
  calves: 24,
  abdominals: 24,
  abs: 24,
  shoulders: 36,
  deltoids: 36,
  chest: 48,
  pecs: 48,
  
  // Large/Compound muscles (recover slower ~48-72h)
  lats: 54,
  upper_back: 54,
  back: 54,
  quadriceps: 72,
  quads: 72,
  hamstrings: 72,
  glutes: 72,
  legs: 72,
  full_body: 72,
  
  // Fallback
  general: 48
};

export function getRecoveryHours(muscleGroup, rpe = 7) {
  if (!muscleGroup) return MUSCLE_RECOVERY_HOURS.general;
  
  const normalized = muscleGroup.toLowerCase().trim().replace(/[-\s]+/g, "_");
  const baseHours = MUSCLE_RECOVERY_HOURS[normalized] || MUSCLE_RECOVERY_HOURS.general;
  
  // RPE-based multiplier logic (higher RPE = longer recovery)
  let multiplier = 1.0;
  if (rpe >= 8) multiplier = 1.5;
  else if (rpe >= 6) multiplier = 1.2;
  else if (rpe > 0 && rpe < 6) multiplier = 0.8;
  
  return baseHours * multiplier;
}
