// src/utils/dailyFatigue.js

/**
 * Groups raw workout logs by date and calculates a daily fatigue level based
 * on the training volume relative to a trailing rolling average of training days.
 * 
 * @param {Array} rawLogs 
 * @returns {Object} Keyed by YYYY-MM-DD date string: { level, volume, avgRpe, setCount, exercises }
 */
export function buildDailyFatigueMap(rawLogs) {
  const dailyMap = {};

  if (!rawLogs || rawLogs.length === 0) {
    return dailyMap;
  }

  // 1. Group logs by date
  const dailyStats = {};
  rawLogs.forEach(log => {
    if (!log.completed_at) return;
    const dateStr = log.completed_at.slice(0, 10); // YYYY-MM-DD
    if (!dailyStats[dateStr]) {
      dailyStats[dateStr] = {
        volume: 0,
        rpeSum: 0,
        rpeCount: 0,
        setCount: 0,
        exercises: new Set()
      };
    }
    const vol = (log.weight_kg || 0) * (log.reps || 0);
    dailyStats[dateStr].volume += vol;
    if (log.rpe) {
      dailyStats[dateStr].rpeSum += log.rpe;
      dailyStats[dateStr].rpeCount += 1;
    }
    dailyStats[dateStr].setCount += 1;
    const exName = log.title || log.work_id;
    if (exName) {
      dailyStats[dateStr].exercises.add(exName);
    }
  });

  // 2. Sort training dates chronologically to calculate trailing rolling average
  const sortedDates = Object.keys(dailyStats).sort((a, b) => new Date(a) - new Date(b));
  const trainingDays = sortedDates.map(date => ({
    date,
    volume: dailyStats[date].volume
  }));

  const windowSize = 7;
  const rollingAverages = {};
  trainingDays.forEach((td, idx) => {
    const startIdx = Math.max(0, idx - windowSize);
    const preceding = trainingDays.slice(startIdx, idx);
    let avg = 0;
    if (preceding.length > 0) {
      avg = preceding.reduce((sum, curr) => sum + curr.volume, 0) / preceding.length;
    } else {
      avg = td.volume || 1; // avoid division by zero
    }
    rollingAverages[td.date] = avg;
  });

  // 3. Populate daily map with levels
  sortedDates.forEach(date => {
    const stats = dailyStats[date];
    const avgVol = rollingAverages[date];
    const score = avgVol > 0 ? stats.volume / avgVol : 1;

    let level = 'moderate';
    if (score < 0.5) {
      level = 'light';
    } else if (score <= 1.0) {
      level = 'moderate';
    } else if (score <= 1.5) {
      level = 'high';
    } else {
      level = 'very-high';
    }

    dailyMap[date] = {
      level,
      volume: stats.volume,
      avgRpe: stats.rpeCount > 0 ? Math.round((stats.rpeSum / stats.rpeCount) * 10) / 10 : null,
      setCount: stats.setCount,
      exercises: Array.from(stats.exercises)
    };
  });

  return dailyMap;
}
