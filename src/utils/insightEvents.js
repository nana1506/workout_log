import { acwrZone } from "./calculations.js";

/**
 * Detects sessions where RPE deviates significantly above trailing rolling average.
 * @param {Array<{ date: string, rpe: number }>} rpeSeries
 * @param {number} thresholdStdDev - standard deviation multiplier (default 1.5)
 * @returns {Array<{ date: string, rpe: number, avgAtTime: number }>}
 */
export function detectRpeSpikes(rpeSeries, thresholdStdDev = 1.5) {
  if (!rpeSeries || rpeSeries.length < 2) return [];

  const spikes = [];
  
  for (let i = 1; i < rpeSeries.length; i++) {
    const historical = rpeSeries.slice(0, i).map(s => s.rpe).filter(r => typeof r === "number" && !isNaN(r));
    if (historical.length < 1) continue;

    const current = rpeSeries[i];
    if (typeof current.rpe !== "number" || isNaN(current.rpe)) continue;

    const sum = historical.reduce((a, b) => a + b, 0);
    const avg = sum / historical.length;

    let stdDev = 0;
    if (historical.length > 1) {
      const variance = historical.reduce((s, val) => s + Math.pow(val - avg, 2), 0) / historical.length;
      stdDev = Math.sqrt(variance);
    }

    const diff = current.rpe - avg;
    const threshold = stdDev > 0 ? thresholdStdDev * stdDev : 1.2;

    if (diff >= threshold && diff >= 0.8) {
      spikes.push({
        date: current.date,
        rpe: current.rpe,
        avgAtTime: Math.round(avg * 10) / 10
      });
    }
  }

  return spikes;
}

/**
 * Severity ranking for ACWR zones
 */
const ZONE_SEVERITY = {
  "Low stimulus": 0,
  "Sweet spot": 1,
  "Caution": 2,
  "High risk": 3
};

/**
 * Walks weeklyStats chronologically and flags each time ACWR enters a more severe zone than the previous week.
 * @param {Array<{ weekIndex: number, date: string, acwr: number }>} weeklyStats
 * @returns {Array<{ weekIndex: number, date: string, acwr: number, zone: string }>}
 */
export function detectAcwrZoneCrossings(weeklyStats) {
  if (!weeklyStats || weeklyStats.length === 0) return [];

  const crossings = [];
  let prevSeverity = -1;

  weeklyStats.forEach((w) => {
    const zoneObj = acwrZone(w.acwr || 0);
    const zoneLabel = zoneObj.label;
    const currentSeverity = ZONE_SEVERITY[zoneLabel] ?? 0;

    if (prevSeverity !== -1 && currentSeverity > prevSeverity && currentSeverity >= 2) {
      crossings.push({
        weekIndex: w.weekIndex,
        date: w.date,
        acwr: w.acwr,
        zone: zoneLabel
      });
    }

    prevSeverity = currentSeverity;
  });

  return crossings;
}

/**
 * Combines PR flags, plateau status, RPE spikes, ACWR zone crossings, and neglected muscles
 * into a flat list of typed events with stable deterministic IDs.
 *
 * @param {Object} params
 * @param {Array} params.oneRmSeries
 * @param {Object} params.plateauStatus
 * @param {Array} params.rpeSeries
 * @param {Array} params.weeklyStats
 * @param {Object} params.muscleBalance
 * @returns {Array<{ id: string, type: string, [key: string]: any }>}
 */
export function buildAnnotationEvents({
  oneRmSeries = [],
  plateauStatus = null,
  rpeSeries = [],
  weeklyStats = [],
  muscleBalance = null
} = {}) {
  const events = [];

  // 1. PR Flags
  if (Array.isArray(oneRmSeries)) {
    oneRmSeries
      .filter(p => p && p.isPR)
      .forEach(p => {
        const rawDate = p.rawDate ? p.rawDate.slice(0, 10) : (p.date || 'unknown');
        events.push({
          id: `pr-${rawDate}`,
          type: "pr",
          date: p.date || rawDate,
          oneRm: p.oneRm,
          label: `PR: ${p.oneRm} kg`
        });
      });
  }

  // 2. Plateau Start
  if (plateauStatus && plateauStatus.isPlateaued && plateauStatus.sinceDate) {
    const formattedSince = typeof plateauStatus.sinceDate === 'string' ? plateauStatus.sinceDate.slice(0, 10) : plateauStatus.sinceDate;
    events.push({
      id: `plateau-${formattedSince}`,
      type: "plateau",
      date: plateauStatus.sinceDate,
      sessionsFlat: plateauStatus.sessionsFlat,
      label: `Plateau detected (${plateauStatus.sessionsFlat} sessions flat)`
    });
  }

  // 3. RPE Spikes
  const rpeSpikes = detectRpeSpikes(rpeSeries);
  rpeSpikes.forEach(spike => {
    events.push({
      id: `rpe-spike-${spike.date}`,
      type: "rpe-spike",
      date: spike.date,
      rpe: spike.rpe,
      avgAtTime: spike.avgAtTime,
      label: `RPE spike (${spike.rpe} vs trailing avg ${spike.avgAtTime})`
    });
  });

  // 4. ACWR Zone Crossings
  const acwrCrossings = detectAcwrZoneCrossings(weeklyStats);
  acwrCrossings.forEach(c => {
    events.push({
      id: `acwr-zone-${c.weekIndex}`,
      type: "acwr-zone",
      weekIndex: c.weekIndex,
      date: c.date,
      acwr: c.acwr,
      zone: c.zone,
      label: `ACWR entered ${c.zone} (${c.acwr})`
    });
  });

  // 5. Neglected Muscles
  if (muscleBalance && Array.isArray(muscleBalance.neglectedMuscles)) {
    muscleBalance.neglectedMuscles.forEach(m => {
      events.push({
        id: `neglected-${m}`,
        type: "neglected-muscle",
        muscle: m,
        label: `Neglected muscle group: ${m}`
      });
    });
  }

  return events;
}
