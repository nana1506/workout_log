import { describe, it, expect } from 'vitest';
import {
  computeMuscleBalance,
  BALANCE_RATIO_CAUTION,
  BALANCE_RATIO_WARNING,
  NEGLECT_THRESHOLD_PCT,
  FUNCTIONAL_GROUPS,
} from './muscleBalance.js';

// Helper to build a stimulus event within the default 28-day window
function makeEvent(muscle, effectiveVolume, daysAgo = 1) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    stimulus_muscle: muscle,
    effectiveVolume,
    completed_at: d.toISOString(),
  };
}

describe('computeMuscleBalance', () => {
  it('returns nulls for empty input', () => {
    const result = computeMuscleBalance([]);
    expect(result.pushPullRatio).toBeNull();
    expect(result.quadHamstringRatio).toBeNull();
    expect(result.neglectedMuscles).toEqual([]);
  });

  it('computes balanced push/pull ratio close to 1.0', () => {
    const events = [
      makeEvent('chest', 500),
      makeEvent('shoulders', 300),
      makeEvent('triceps', 200),
      // Pull: total 1000
      makeEvent('upper_back', 500),
      makeEvent('lats', 300),
      makeEvent('biceps', 200),
    ];
    const result = computeMuscleBalance(events);
    expect(result.pushPullRatio).toBe(1.0);
    expect(result.neglectedMuscles).toEqual([]);
  });

  it('detects push-heavy imbalance', () => {
    const events = [
      makeEvent('chest', 1000),
      makeEvent('shoulders', 800),
      makeEvent('triceps', 400),
      // Minimal pull
      makeEvent('lats', 100),
    ];
    const result = computeMuscleBalance(events);
    // Push = 2200, Pull = 100 → ratio 22.0
    expect(result.pushPullRatio).toBeGreaterThan(BALANCE_RATIO_WARNING);
  });

  it('detects neglected muscles when one side is near-zero', () => {
    const events = [
      makeEvent('chest', 2000),
      makeEvent('shoulders', 1000),
      // No pull at all
    ];
    const result = computeMuscleBalance(events);
    // All pull muscles should be neglected
    expect(result.neglectedMuscles).toContain('upper_back');
    expect(result.neglectedMuscles).toContain('lats');
    expect(result.neglectedMuscles).toContain('biceps');
  });

  it('computes quad/hamstring ratio', () => {
    const events = [
      makeEvent('quadriceps', 1500),
      makeEvent('hamstrings', 1000),
    ];
    const result = computeMuscleBalance(events);
    expect(result.quadHamstringRatio).toBe(1.5);
  });

  it('excludes events outside the window', () => {
    const events = [
      makeEvent('chest', 1000, 35), // 35 days ago — outside 28-day window
      makeEvent('lats', 500, 5),    // inside window
    ];
    const result = computeMuscleBalance(events);
    // Only pull volume should be counted; push is 0 → ratio is 0
    expect(result.pushPullRatio).toBe(0);
    expect(result.totalVolumeByMuscle['chest']).toBeUndefined();
    expect(result.totalVolumeByMuscle['lats']).toBe(500);
  });

  it('ignores muscles outside the functional classification', () => {
    const events = [
      makeEvent('abdominals', 5000),
      makeEvent('calves', 3000),
    ];
    const result = computeMuscleBalance(events);
    // These don't participate in push/pull or anterior/posterior
    expect(result.pushPullRatio).toBeNull();
    expect(result.quadHamstringRatio).toBeNull();
    expect(result.neglectedMuscles).toEqual([]);
    // But they should still appear in totalVolumeByMuscle
    expect(result.totalVolumeByMuscle['abdominals']).toBe(5000);
  });

  it('exports tunable threshold constants', () => {
    expect(BALANCE_RATIO_CAUTION).toBe(1.4);
    expect(BALANCE_RATIO_WARNING).toBe(1.8);
    expect(NEGLECT_THRESHOLD_PCT).toBe(0.10);
  });

  it('handles Infinity ratio when counterpart is zero', () => {
    const events = [
      makeEvent('chest', 1000),
      makeEvent('shoulders', 500),
      // No pull volume at all
    ];
    const result = computeMuscleBalance(events);
    expect(result.pushPullRatio).toBe(Infinity);
  });
});
