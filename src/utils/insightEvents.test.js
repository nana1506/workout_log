import { describe, it, expect } from 'vitest';
import { detectRpeSpikes, detectAcwrZoneCrossings, buildAnnotationEvents } from './insightEvents.js';

describe('insightEvents', () => {
  describe('detectRpeSpikes', () => {
    it('returns empty array for small or invalid rpeSeries', () => {
      expect(detectRpeSpikes(null)).toEqual([]);
      expect(detectRpeSpikes([])).toEqual([]);
      expect(detectRpeSpikes([{ date: 'Aug 1', rpe: 7 }])).toEqual([]);
    });

    it('detects significant RPE spikes above rolling trailing average', () => {
      const rpeSeries = [
        { date: 'Aug 1', rpe: 7.0 },
        { date: 'Aug 2', rpe: 7.0 },
        { date: 'Aug 3', rpe: 7.0 },
        { date: 'Aug 4', rpe: 9.5 }, // spike!
      ];

      const spikes = detectRpeSpikes(rpeSeries);
      expect(spikes.length).toBe(1);
      expect(spikes[0].date).toBe('Aug 4');
      expect(spikes[0].rpe).toBe(9.5);
      expect(spikes[0].avgAtTime).toBe(7.0);
    });
  });

  describe('detectAcwrZoneCrossings', () => {
    it('detects escalation into Caution or High risk zones', () => {
      const weeklyStats = [
        { weekIndex: 0, date: '2026-08-01', acwr: 0.9 }, // Sweet spot
        { weekIndex: 1, date: '2026-08-08', acwr: 1.1 }, // Sweet spot
        { weekIndex: 2, date: '2026-08-15', acwr: 1.4 }, // Caution (escalation)
        { weekIndex: 3, date: '2026-08-22', acwr: 1.6 }, // High risk (escalation)
      ];

      const crossings = detectAcwrZoneCrossings(weeklyStats);
      expect(crossings.length).toBe(2);
      expect(crossings[0].weekIndex).toBe(2);
      expect(crossings[0].zone).toBe('Caution');
      expect(crossings[1].weekIndex).toBe(3);
      expect(crossings[1].zone).toBe('High risk');
    });
  });

  describe('buildAnnotationEvents', () => {
    it('combines PRs, plateaus, RPE spikes, ACWR crossings, and neglected muscles with stable IDs', () => {
      const oneRmSeries = [
        { rawDate: '2026-08-01T00:00:00Z', date: 'Aug 1', oneRm: 100, isPR: true },
        { rawDate: '2026-08-05T00:00:00Z', date: 'Aug 5', oneRm: 95, isPR: false },
      ];
      const plateauStatus = { isPlateaued: true, sessionsFlat: 5, sinceDate: '2026-08-01' };
      const rpeSeries = [
        { date: 'Aug 1', rpe: 7 },
        { date: 'Aug 2', rpe: 7 },
        { date: 'Aug 3', rpe: 9.5 },
      ];
      const weeklyStats = [
        { weekIndex: 0, date: '2026-08-01', acwr: 1.0 },
        { weekIndex: 1, date: '2026-08-08', acwr: 1.45 },
      ];
      const muscleBalance = { neglectedMuscles: ['hamstrings'] };

      const events = buildAnnotationEvents({
        oneRmSeries,
        plateauStatus,
        rpeSeries,
        weeklyStats,
        muscleBalance,
      });

      expect(events).toEqual([
        {
          id: 'pr-2026-08-01',
          type: 'pr',
          date: 'Aug 1',
          oneRm: 100,
          label: 'PR: 100 kg',
        },
        {
          id: 'plateau-2026-08-01',
          type: 'plateau',
          date: '2026-08-01',
          sessionsFlat: 5,
          label: 'Plateau detected (5 sessions flat)',
        },
        {
          id: 'rpe-spike-Aug 3',
          type: 'rpe-spike',
          date: 'Aug 3',
          rpe: 9.5,
          avgAtTime: 7,
          label: 'RPE spike (9.5 vs trailing avg 7)',
        },
        {
          id: 'acwr-zone-1',
          type: 'acwr-zone',
          weekIndex: 1,
          date: '2026-08-08',
          acwr: 1.45,
          zone: 'Caution',
          label: 'ACWR entered Caution (1.45)',
        },
        {
          id: 'neglected-hamstrings',
          type: 'neglected-muscle',
          muscle: 'hamstrings',
          label: 'Neglected muscle group: hamstrings',
        },
      ]);
    });
  });
});
