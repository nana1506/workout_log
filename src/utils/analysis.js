// Linreg slope calculation helper
export function getLinregSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// 3. Plateau Detection logic
export function detectPlateau(oneRmSeries, windowSize = 5, thresholdPercent = 0.01) {
  if (!oneRmSeries || oneRmSeries.length < windowSize) {
    return { isPlateaued: false, sessionsFlat: 0, sinceDate: null };
  }
  
  const windowSessions = oneRmSeries.slice(-windowSize);
  const points = windowSessions.map((p, i) => ({ x: i, y: p.oneRm }));
  const slope = getLinregSlope(points);
  
  const avg1Rm = windowSessions.reduce((sum, p) => sum + p.oneRm, 0) / windowSize;
  const max1Rm = Math.max(...windowSessions.map(p => p.oneRm));
  const min1Rm = Math.min(...windowSessions.map(p => p.oneRm));
  const spread = max1Rm - min1Rm;
  const spreadThreshold = avg1Rm * thresholdPercent;
  
  // A plateau is flagged when both the slope is near-zero and the spread is small
  const isPlateaued = Math.abs(slope) < 0.15 && spread < Math.max(1.5, spreadThreshold);
  
  return {
    isPlateaued,
    sessionsFlat: windowSize,
    sinceDate: windowSessions[0].date
  };
}

// 4. Injury-Risk Flag logic
export function detectInjuryRisk(exerciseLogs) {
  if (!exerciseLogs || exerciseLogs.length < 3) {
    return { level: "none", reason: "" };
  }
  
  // Sort logs chronologically
  const sortedLogs = [...exerciseLogs].sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
  
  // Group sets by completed_at date (slice to YYYY-MM-DD)
  const sessions = [];
  const groups = {};
  sortedLogs.forEach(r => {
    if (!r.completed_at) return;
    const d = r.completed_at.slice(0, 10);
    if (!groups[d]) {
      groups[d] = { rpeValues: [], weights: [] };
      sessions.push(d);
    }
    if (r.rpe) groups[d].rpeValues.push(r.rpe);
    if (r.weight_kg) groups[d].weights.push(r.weight_kg);
  });
  
  // Calculate average RPE and max weight per session
  const sessionStats = sessions.map(d => {
    const g = groups[d];
    const avgRpe = g.rpeValues.length ? g.rpeValues.reduce((s, v) => s + v, 0) / g.rpeValues.length : null;
    const maxWeight = g.weights.length ? Math.max(...g.weights) : 0;
    return { date: d, avgRpe, maxWeight };
  }).filter(s => s.avgRpe !== null);
  
  if (sessionStats.length < 3) {
    return { level: "none", reason: "" };
  }
  
  const recentSession = sessionStats[sessionStats.length - 1];
  const priorSessionsOnly = sessionStats.slice(0, -1);
  
  const trailingAvgRpe = priorSessionsOnly.reduce((s, o) => s + o.avgRpe, 0) / priorSessionsOnly.length;
  const trailingAvgWeight = priorSessionsOnly.reduce((s, o) => s + o.maxWeight, 0) / priorSessionsOnly.length;
  
  const rpeSpike = recentSession.avgRpe - trailingAvgRpe;
  const weightIncreased = recentSession.maxWeight >= trailingAvgWeight;
  
  if (rpeSpike >= 2.0 && weightIncreased) {
    return {
      level: "elevated",
      reason: `Recent session RPE is significantly elevated (+${rpeSpike.toFixed(1)} points) compared to your historical average (${trailingAvgRpe.toFixed(1)}) at equivalent/higher load.`
    };
  } else if (rpeSpike >= 1.5 && weightIncreased) {
    return {
      level: "watch",
      reason: `Subtle RPE spike (+${rpeSpike.toFixed(1)} points) detected at equivalent/higher load.`
    };
  }
  
  return { level: "none", reason: "" };
}
