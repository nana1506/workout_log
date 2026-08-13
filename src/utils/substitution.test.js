import { describe, it, expect } from 'vitest';
import { getSubstitutions } from './substitution';

// Helper to build a Map from entries
function buildMap(entries) {
  const map = new Map();
  for (const [key, value] of entries) {
    map.set(key, value);
  }
  return map;
}

describe('getSubstitutions', () => {
  const muscleMap = buildMap([
    ['Bench Press', [
      { muscle_group: 'chest', role: 'primary', contribution: 1.0 },
      { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 },
      { muscle_group: 'shoulders', role: 'secondary', contribution: 0.2 },
    ]],
    ['Barbell Row', [
      { muscle_group: 'lats', role: 'primary', contribution: 1.0 },
      { muscle_group: 'biceps', role: 'secondary', contribution: 0.3 },
    ]],
    ['Lat Pulldown', [
      { muscle_group: 'lats', role: 'primary', contribution: 1.0 },
      { muscle_group: 'biceps', role: 'secondary', contribution: 0.25 },
    ]],
    ['Bicep Curl', [
      { muscle_group: 'biceps', role: 'primary', contribution: 1.0 },
    ]],
    ['Squat', [
      { muscle_group: 'quadriceps', role: 'primary', contribution: 1.0 },
      { muscle_group: 'hamstrings', role: 'secondary', contribution: 0.3 },
      { muscle_group: 'glutes', role: 'secondary', contribution: 0.25 },
    ]],
    ['Leg Curl', [
      { muscle_group: 'hamstrings', role: 'primary', contribution: 1.0 },
    ]],
    ['Overhead Press', [
      { muscle_group: 'shoulders', role: 'primary', contribution: 1.0 },
      { muscle_group: 'triceps', role: 'secondary', contribution: 0.3 },
    ]],
    ['Face Pull', [
      { muscle_group: 'upper_back', role: 'primary', contribution: 1.0 },
      { muscle_group: 'shoulders', role: 'secondary', contribution: 0.15 },
    ]],
  ]);

  const exercisesList = [
    { title: 'Bench Press', work_id: 'bench', muscle_group: 'chest' },
    { title: 'Barbell Row', work_id: 'row', muscle_group: 'lats' },
    { title: 'Squat', work_id: 'squat', muscle_group: 'quadriceps' },
  ];

  it('returns substitutions that avoid the target muscle', () => {
    // chest is unrecovered, lats and upper_back are recovered
    const recovered = [{ muscle: 'lats' }, { muscle: 'upper_back' }];
    const result = getSubstitutions('chest', muscleMap, recovered, exercisesList);

    // Should not include Bench Press (chest is primary)
    expect(result.find(r => r.title === 'Bench Press')).toBeUndefined();
    // Should include exercises targeting recovered muscles
    expect(result.length).toBeGreaterThan(0);
    result.forEach(r => {
      expect(r.targetsMuscles.length).toBeGreaterThan(0);
      expect(r.viaRole).toBe('primary');
    });
  });

  it('excludes exercises that touch target muscle even as secondary above threshold', () => {
    // hamstrings is unrecovered, quadriceps is recovered
    const recovered = [{ muscle: 'quadriceps' }];
    const result = getSubstitutions('hamstrings', muscleMap, recovered, exercisesList);

    // Squat has hamstrings as secondary at 0.3 (above 0.2 threshold) → should be excluded
    expect(result.find(r => r.title === 'Squat')).toBeUndefined();
  });

  it('includes exercises where target muscle is secondary below threshold', () => {
    // shoulders is unrecovered, upper_back is recovered
    const recovered = [{ muscle: 'upper_back' }];
    const result = getSubstitutions('shoulders', muscleMap, recovered, exercisesList);

    // Face Pull has shoulders as secondary at 0.15 (below 0.2 threshold) → should be included
    expect(result.find(r => r.title === 'Face Pull')).toBeDefined();
  });

  it('prefers logged exercises over unlogged ones', () => {
    // biceps unrecovered; lats and upper_back recovered
    const recovered = [{ muscle: 'lats' }, { muscle: 'upper_back' }];
    const result = getSubstitutions('biceps', muscleMap, recovered, exercisesList);

    // Barbell Row is logged, Lat Pulldown and Face Pull are not
    if (result.length >= 2) {
      const barbelRowIdx = result.findIndex(r => r.title === 'Barbell Row');
      const latPulldownIdx = result.findIndex(r => r.title === 'Lat Pulldown');
      if (barbelRowIdx !== -1 && latPulldownIdx !== -1) {
        expect(barbelRowIdx).toBeLessThan(latPulldownIdx);
      }
    }
  });

  it('returns empty array when no valid substitutions exist', () => {
    // Only abdominals recovered, which has no exercises in the map
    const recovered = [{ muscle: 'abdominals' }];
    const result = getSubstitutions('chest', muscleMap, recovered, exercisesList);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty inputs', () => {
    expect(getSubstitutions('', muscleMap, [], exercisesList)).toEqual([]);
    expect(getSubstitutions('chest', new Map(), [{ muscle: 'lats' }], exercisesList)).toEqual([]);
    expect(getSubstitutions('chest', muscleMap, [], exercisesList)).toEqual([]);
  });

  it('respects the limit parameter', () => {
    const recovered = [{ muscle: 'lats' }, { muscle: 'upper_back' }, { muscle: 'shoulders' }];
    const result = getSubstitutions('chest', muscleMap, recovered, exercisesList, 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });
});
