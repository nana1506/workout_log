import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dumbbell, Trophy, Database, X, Scale, Brain,
  RefreshCw, ChevronDown, CalendarCheck, Download
} from "lucide-react";

import { getRecoveryHours } from "./utils/recovery";
import { detectPlateau, detectInjuryRisk } from "./utils/analysis";
import { exportToCSV } from "./utils/csv";
import BodyCompositionTab from "./components/BodyCompositionTab";
import InsightsTab from "./components/InsightsTab";
import DecisionTab from "./components/DecisionTab";
import ProgramTab from "./components/ProgramTab";
import { buildDailyFatigueMap } from "./utils/dailyFatigue";
import {
  buildMuscleMapLookup,
  getMusclesForExercise,
  expandLogsWithMuscleStimulus
} from "./utils/muscleMap";
import {
  estOneRM,
  linregSlope,
  fmtDate,
  acwrZone,
  getTrainingSplit,
  getRadarMuscleCategory,
  buildOneRmSeries
} from "./utils/calculations";
import { MUSCLE_COLORS, PERIODS } from "./constants";

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function fetchWorkoutLogs() {
  const { data, error } = await supabase
    .from('workout_log')
    .select('*')
    .order('completed_at', { ascending: false });

  if (error) {
    console.error("Supabase Query Error:", error);
    throw error;
  }

  return data || [];
}

export async function fetchBodyMetrics() {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error("Supabase Query Error:", error);
    throw error;
  }

  return data || [];
}

export async function fetchMuscleMap() {
  const { data, error } = await supabase
    .from('exercise_muscle_map')
    .select('*');

  if (error) {
    console.error("Supabase Query Error:", error);
    throw error;
  }

  return data || [];
}

export async function fetchTrainingGoals() {
  const { data, error } = await supabase
    .from('training_goals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Supabase Query Error fetching training_goals:", error);
    throw error;
  }

  return data || [];
}

export async function fetchPrograms() {
  const { data, error } = await supabase
    .from('training_programs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Supabase Query Error fetching training_programs:", error);
    throw error;
  }
  return data || [];
}

export async function fetchProgramDays() {
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Supabase Query Error fetching program_days:", error);
    throw error;
  }
  return data || [];
}

export async function fetchProgramExercises() {
  const { data, error } = await supabase
    .from('program_exercises')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Supabase Query Error fetching program_exercises:", error);
    throw error;
  }
  return data || [];
}

export default function WorkoutDashboard() {
  const [activeTab, setActiveTab] = useState("insights"); // "insights" or "decision"
  const [radarMetric, setRadarMetric] = useState("sets"); // "sets" or "volume"
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [periodIdx, setPeriodIdx] = useState(0); // Default to '7D'
  const [selectedExerciseId, setSelectedExerciseId] = useState("all");
  const [showSetup, setShowSetup] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [exerciseDropdownOpen, setExerciseDropdownOpen] = useState(false);

  const [dateFilterMode, setDateFilterMode] = useState("all"); // "all" or "custom"
  const [selectedDates, setSelectedDates] = useState([]);

  const [sortColumn, setSortColumn] = useState("completed_at");
  const [sortDirection, setSortDirection] = useState("desc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // AI Coaching states
  const [aiCoaching, setAiCoaching] = useState(null);
  const [aiCoachingLoading, setAiCoachingLoading] = useState(false);

  // AI Block Assessment states
  const [blockAssessment, setBlockAssessment] = useState(null);
  const [blockAssessmentLoading, setBlockAssessmentLoading] = useState(false);

  // Reset pagination on filter/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedExerciseId, dateFilterMode, selectedDates, periodIdx, sortColumn, sortDirection]);

  const [rawLogs, setRawLogs] = useState([]);
  const [bodyMetrics, setBodyMetrics] = useState([]);
  const [muscleMapRows, setMuscleMapRows] = useState(null);
  const [trainingGoals, setTrainingGoals] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [programDays, setProgramDays] = useState([]);
  const [programExercises, setProgramExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [logsData, metricsData, muscleMapData, goalsData, programsData, daysData, exercisesData] = await Promise.all([
        fetchWorkoutLogs(),
        fetchBodyMetrics(),
        fetchMuscleMap(),
        fetchTrainingGoals(),
        fetchPrograms(),
        fetchProgramDays(),
        fetchProgramExercises()
      ]);
      console.log("Raw Supabase Data Loaded:", logsData);
      console.log("Raw Body Metrics Loaded:", metricsData);
      console.log("Raw Muscle Map Loaded:", muscleMapData);
      console.log("Raw Training Goals Loaded:", goalsData);
      console.log("Raw Programs Loaded:", programsData);
      
      // Sanitize logs: filter out invalid/empty rows and normalize workout_id
      const sanitized = (logsData || [])
        .filter((r) => r.completed_at)
        .map((r) => ({
          ...r,
          work_id: r.workout_id || r.work_id,
        }));

      setRawLogs(sanitized);
      setBodyMetrics(metricsData || []);
      setMuscleMapRows(muscleMapData || []);
      setTrainingGoals(goalsData || []);
      setPrograms(programsData || []);
      setProgramDays(daysData || []);
      setProgramExercises(exercisesData || []);
    } catch (err) {
      console.error("Failed to load workout logs or body metrics from Supabase:", err);
      setErrorMsg(err.message || "Failed to load database rows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const muscleMapLookup = useMemo(() => buildMuscleMapLookup(muscleMapRows || []), [muscleMapRows]);
  const expandedStimulus = useMemo(() => expandLogsWithMuscleStimulus(rawLogs, muscleMapLookup), [rawLogs, muscleMapLookup]);

  const programsWithDays = useMemo(() => {
    if (!programs.length) return [];
    
    return programs.map(program => {
      const days = programDays
        .filter(d => d.program_id === program.id)
        .map(day => {
          const exercises = programExercises
            .filter(e => e.program_day_id === day.id)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          return {
            ...day,
            exercises
          };
        });
        
      if (program.schedule_type === 'fixed_days') {
        const weekdayOrder = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
        days.sort((a, b) => (weekdayOrder[(a.weekday || "").toLowerCase()] || 99) - (weekdayOrder[(b.weekday || "").toLowerCase()] || 99));
      } else {
        days.sort((a, b) => (a.day_order || 0) - (b.day_order || 0));
      }
      
      return {
        ...program,
        days
      };
    });
  }, [programs, programDays, programExercises]);

  // 1. Dynamic Exercise Options built directly from your table
  const exercisesList = useMemo(() => {
    if (!rawLogs.length) return [];
    const map = new Map();
    rawLogs.forEach((r) => {
      const exerciseTitle = r.title || r.work_id;
      if (exerciseTitle) {
        const cleanTitle = exerciseTitle.trim().toLowerCase();
        if (!map.has(cleanTitle)) {
          map.set(cleanTitle, {
            work_id: r.work_id || exerciseTitle,
            title: r.title || r.work_id,
            muscle_group: r.muscle_group || "General"
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [rawLogs]);

  // Unique list of dates in YYYY-MM-DD format
  const uniqueDates = useMemo(() => {
    if (!rawLogs.length) return [];
    const dates = rawLogs.map((r) => r.completed_at?.slice(0, 10)).filter(Boolean);
    return [...new Set(dates)].sort().reverse();
  }, [rawLogs]);

  const dailyFatigueMap = useMemo(() => buildDailyFatigueMap(rawLogs), [rawLogs]);

  // Set default selected exercise once data loads
  useEffect(() => {
    if (exercisesList.length && !selectedExerciseId) {
      setSelectedExerciseId("all");
    }
  }, [exercisesList, selectedExerciseId]);

  // 2. Dynamic Anchor Date derived from selected custom dates or the latest log date in Supabase
  const anchorDate = useMemo(() => {
    if (dateFilterMode === "custom" && selectedDates.length > 0) {
      const latestSelected = [...selectedDates].sort().reverse()[0];
      return new Date(latestSelected + "T23:59:59Z");
    }
    if (!rawLogs.length) return new Date();
    const latestIso = rawLogs.reduce((max, r) => (r.completed_at > max ? r.completed_at : max), rawLogs[0].completed_at);
    return new Date(latestIso);
  }, [rawLogs, dateFilterMode, selectedDates]);

  // 3. Attach derived week indices relative to the latest log
  const logs = useMemo(() => {
    return rawLogs.map((row) => {
      const rowDate = new Date(row.completed_at);
      const diffDays = Math.floor((anchorDate - rowDate) / (1000 * 60 * 60 * 24));
      const weeksAgo = Math.floor(diffDays / 7);
      const weekIdx = 10 - 1 - weeksAgo;
      return {
        ...row,
        _weekIndex: Math.max(0, Math.min(10 - 1, weekIdx)),
      };
    });
  }, [rawLogs, anchorDate]);

  const period = PERIODS[periodIdx];
  const cutoff = useMemo(() => {
    if (period.days === null) {
      return new Date(0); // Epoch
    }
    const c = new Date(anchorDate);
    c.setDate(c.getDate() - period.days);
    return c;
  }, [anchorDate, period]);

  const prevCutoff = useMemo(() => {
    if (period.days === null) {
      return new Date(0);
    }
    const c = new Date(cutoff);
    c.setDate(c.getDate() - period.days);
    return c;
  }, [cutoff, period]);

  // Filter logs globally based on selected exercise
  const exerciseFilteredLogs = useMemo(() => {
    if (selectedExerciseId === "all") {
      return logs;
    }
    const targetEx = exercisesList.find((e) => e.work_id === selectedExerciseId);
    if (!targetEx) return [];
    return logs.filter((r) => (r.title || r.work_id) === targetEx.title);
  }, [logs, selectedExerciseId, exercisesList]);

  const activeExercise = useMemo(() => {
    return exercisesList.find((e) => e.work_id === selectedExerciseId) || { title: "Overall", muscle_group: "Multiple" };
  }, [exercisesList, selectedExerciseId]);

  // ---- Core KPI calculations using kpiLogs ----
  const kpiLogs = useMemo(() => {
    let current = [];
    let prior = [];
    
    if (dateFilterMode === "custom") {
      current = exerciseFilteredLogs.filter(r => selectedDates.includes(r.completed_at.slice(0, 10)));
      
      if (selectedDates.length > 0) {
        const minDate = [...selectedDates].sort()[0];
        const exerciseDates = [...new Set(exerciseFilteredLogs.map(r => r.completed_at.slice(0, 10)))].sort().reverse();
        const priorDates = exerciseDates.filter(d => d < minDate);
        if (priorDates.length > 0) {
          const prevDate = priorDates[0];
          prior = exerciseFilteredLogs.filter(r => r.completed_at.slice(0, 10) === prevDate);
        }
      }
    } else {
      current = exerciseFilteredLogs.filter(r => new Date(r.completed_at) >= cutoff && new Date(r.completed_at) <= anchorDate);
      prior = exerciseFilteredLogs.filter(r => new Date(r.completed_at) >= prevCutoff && new Date(r.completed_at) < cutoff);
    }
    return { current, prior };
  }, [exerciseFilteredLogs, dateFilterMode, selectedDates, cutoff, prevCutoff, anchorDate]);

  const totalVolume = kpiLogs.current.reduce((s, r) => s + (r.weight_kg || 0) * (r.reps || 0), 0);
  const prevVolume = kpiLogs.prior.reduce((s, r) => s + (r.weight_kg || 0) * (r.reps || 0), 0);
  const volumeDelta = prevVolume ? ((totalVolume - prevVolume) / prevVolume) * 100 : 0;

  const avgRpe = kpiLogs.current.length ? kpiLogs.current.reduce((s, r) => s + (r.rpe || 0), 0) / kpiLogs.current.length : 0;
  const prevAvgRpe = kpiLogs.prior.length ? kpiLogs.prior.reduce((s, r) => s + (r.rpe || 0), 0) / kpiLogs.prior.length : 0;
  const rpeDelta = prevAvgRpe ? ((avgRpe - prevAvgRpe) / prevAvgRpe) * 100 : 0;

  const sessionsCount = new Set(kpiLogs.current.map((r) => (r.set_id ? r.set_id.split("-s")[0] : r.completed_at?.slice(0, 10)))).size;
  const prevSessionsCount = new Set(kpiLogs.prior.map((r) => (r.set_id ? r.set_id.split("-s")[0] : r.completed_at?.slice(0, 10)))).size;
  const sessionsDelta = prevSessionsCount ? ((sessionsCount - prevSessionsCount) / prevSessionsCount) * 100 : 0;

  const currentBest1RM = kpiLogs.current.length ? Math.round(Math.max(...kpiLogs.current.map(r => r.best_1rm || estOneRM(r.weight_kg, r.reps))) * 100) / 100 : 0;
  const priorBest1RM = kpiLogs.prior.length ? Math.round(Math.max(...kpiLogs.prior.map(r => r.best_1rm || estOneRM(r.weight_kg, r.reps))) * 100) / 100 : 0;
  const oneRmDelta = priorBest1RM ? ((currentBest1RM - priorBest1RM) / priorBest1RM) * 100 : null;

  // ---- Weekly training-load stats (ACWR) ----
  const weeklyStats = useMemo(() => {
    if (!exerciseFilteredLogs.length) return [];
    
    const logsBeforeAnchor = exerciseFilteredLogs.filter(r => new Date(r.completed_at) <= anchorDate);
    if (!logsBeforeAnchor.length) return [];
    
    const minDate = logsBeforeAnchor.reduce((min, r) => r.completed_at < min ? r.completed_at : min, logsBeforeAnchor[0].completed_at);
    const minD = new Date(minDate);
    const totalDays = Math.ceil((anchorDate - minD) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.max(10, Math.ceil(totalDays / 7));
    
    const volumeByWeek = Array(totalWeeks).fill(0);
    const dateByWeek = Array(totalWeeks).fill(null);
    
    logsBeforeAnchor.forEach((r) => {
      const rowDate = new Date(r.completed_at);
      const diffDays = Math.floor((anchorDate - rowDate) / (1000 * 60 * 60 * 24));
      const weeksAgo = Math.floor(diffDays / 7);
      const weekIdx = totalWeeks - 1 - weeksAgo;
      
      if (weekIdx >= 0 && weekIdx < totalWeeks) {
        volumeByWeek[weekIdx] += (r.weight_kg || 0) * (r.reps || 0);
        if (!dateByWeek[weekIdx] || new Date(r.completed_at) > new Date(dateByWeek[weekIdx])) {
          dateByWeek[weekIdx] = r.completed_at;
        }
      }
    });

    return volumeByWeek.map((vol, w) => {
      const windowStart = Math.max(0, w - 3);
      const windowVols = volumeByWeek.slice(windowStart, w + 1);
      const chronic = windowVols.reduce((a, b) => a + b, 0) / windowVols.length;
      const acwr = chronic ? Math.round((vol / chronic) * 100) / 100 : 0;
      const isDeload = chronic > 0 && vol < chronic * 0.8;
      const calculatedDate = dateByWeek[w] || new Date(anchorDate.getTime() - (totalWeeks - 1 - w) * 7 * 24 * 60 * 60 * 1000).toISOString();
      return { weekIndex: w, volume: Math.round(vol), chronic: Math.round(chronic), acwr, isDeload, date: calculatedDate };
    });
  }, [exerciseFilteredLogs, anchorDate]);

  // Adjust ACWR visible weekly stats based on period selection
  const visibleWeeklyStats = useMemo(() => {
    if (!weeklyStats.length) return [];
    if (period.days === 7) return weeklyStats.slice(-8); // Show 8 weeks for context
    if (period.days === 30) return weeklyStats.slice(-12);
    return weeklyStats;
  }, [weeklyStats, period]);

  const currentAcwr = weeklyStats.length ? weeklyStats[weeklyStats.length - 1].acwr : 0;
  const acwrInfo = acwrZone(currentAcwr);

  // ---- 1RM series for trend chart (shows history leading up to anchor) ----
  const trendBaseLogs = useMemo(() => {
    return exerciseFilteredLogs.filter(r => new Date(r.completed_at) <= anchorDate);
  }, [exerciseFilteredLogs, anchorDate]);

  const fullSeries = useMemo(() => {
    return buildOneRmSeries(trendBaseLogs, selectedExerciseId === "all");
  }, [trendBaseLogs, selectedExerciseId]);

  const oneRmSeries = useMemo(() => {
    return fullSeries.filter(p => new Date(p.rawDate) >= cutoff);
  }, [fullSeries, cutoff]);

  const overallProgressRateStats = useMemo(() => {
    if (selectedExerciseId !== "all") {
      const slope = linregSlope(oneRmSeries.map((p, i) => ({ x: i, y: p.oneRm })));
      const start1Rm = oneRmSeries.length ? oneRmSeries[0].oneRm : 0;
      const slopePct = start1Rm ? (slope / start1Rm) * 100 : 0;
      return { slope, slopePct };
    } else {
      const slopes = exercisesList.map(ex => {
        const exLogs = logs.filter(r => (r.title || r.work_id) === ex.title && new Date(r.completed_at) <= anchorDate);
        const series = buildOneRmSeries(exLogs, false).filter(p => new Date(p.rawDate) >= cutoff);
        const slope = linregSlope(series.map((p, i) => ({ x: i, y: p.oneRm })));
        const start1Rm = series.length ? series[0].oneRm : 0;
        return { slope, start1Rm };
      }).filter(s => s.slope !== 0);

      if (!slopes.length) return { slope: 0, slopePct: 0 };
      const avgSlope = slopes.reduce((sum, s) => sum + s.slope, 0) / slopes.length;
      const avgStart = slopes.reduce((sum, s) => sum + s.start1Rm, 0) / slopes.length;
      const avgSlopePct = avgStart ? (avgSlope / avgStart) * 100 : 0;
      return { slope: avgSlope, slopePct: avgSlopePct };
    }
  }, [selectedExerciseId, oneRmSeries, exercisesList, cutoff, anchorDate, logs]);

  // ---- Volume by muscle group ----
  const muscleVolumeLogs = useMemo(() => {
    if (dateFilterMode === "custom") {
      return exerciseFilteredLogs.filter(r => selectedDates.includes(r.completed_at.slice(0, 10)));
    }
    return exerciseFilteredLogs.filter(r => new Date(r.completed_at) >= cutoff && new Date(r.completed_at) <= anchorDate);
  }, [exerciseFilteredLogs, dateFilterMode, selectedDates, cutoff, anchorDate]);

  const volumeByMuscle = useMemo(() => {
    const weeks = {};
    let totalWeeks = 10;
    if (muscleVolumeLogs.length) {
      const minDate = muscleVolumeLogs.reduce((min, r) => r.completed_at < min ? r.completed_at : min, muscleVolumeLogs[0].completed_at);
      const minD = new Date(minDate);
      const totalDays = Math.ceil((anchorDate - minD) / (1000 * 60 * 60 * 24));
      totalWeeks = Math.max(10, Math.ceil(totalDays / 7));
    }

    muscleVolumeLogs.forEach((r) => {
      const rowDate = new Date(r.completed_at);
      const diffDays = Math.floor((anchorDate - rowDate) / (1000 * 60 * 60 * 24));
      const weeksAgo = Math.floor(diffDays / 7);
      
      const groupKey = (period.days && period.days <= 30) || dateFilterMode === "custom" 
        ? fmtDate(r.completed_at) 
        : `Wk ${totalWeeks - weeksAgo}`;
        
      weeks[groupKey] = weeks[groupKey] || { name: groupKey };
      const mg = r.muscle_group || "Other";
      weeks[groupKey][mg] = (weeks[groupKey][mg] || 0) + (r.weight_kg || 0) * (r.reps || 0);
    });
    return Object.values(weeks);
  }, [muscleVolumeLogs, period, dateFilterMode, anchorDate]);

  const muscleGroups = useMemo(() => {
    return [...new Set(muscleVolumeLogs.map((r) => r.muscle_group || "Other"))];
  }, [muscleVolumeLogs]);

  const radarChartData = useMemo(() => {
    const sets = { Back: 0, Chest: 0, Arm: 0, Core: 0, Legs: 0 };
    const volume = { Back: 0, Chest: 0, Arm: 0, Core: 0, Legs: 0 };
    
    muscleVolumeLogs.forEach((r) => {
      const cat = getRadarMuscleCategory(r.muscle_group);
      if (cat !== "Other") {
        sets[cat] += 1;
        volume[cat] += (r.weight_kg || 0) * (r.reps || 0);
      }
    });

    const totalSets = Object.values(sets).reduce((a, b) => a + b, 0);
    const totalVolume = Object.values(volume).reduce((a, b) => a + b, 0);

    return [
      { subject: "Back", sets: sets.Back, volume: Math.round(volume.Back), pctSets: totalSets ? Math.round((sets.Back / totalSets) * 100) : 0, pctVolume: totalVolume ? Math.round((volume.Back / totalVolume) * 100) : 0 },
      { subject: "Chest", sets: sets.Chest, volume: Math.round(volume.Chest), pctSets: totalSets ? Math.round((sets.Chest / totalSets) * 100) : 0, pctVolume: totalVolume ? Math.round((volume.Chest / totalVolume) * 100) : 0 },
      { subject: "Arm", sets: sets.Arm, volume: Math.round(volume.Arm), pctSets: totalSets ? Math.round((sets.Arm / totalSets) * 100) : 0, pctVolume: totalVolume ? Math.round((volume.Arm / totalVolume) * 100) : 0 },
      { subject: "Core", sets: sets.Core, volume: Math.round(volume.Core), pctSets: totalSets ? Math.round((sets.Core / totalSets) * 100) : 0, pctVolume: totalVolume ? Math.round((volume.Core / totalVolume) * 100) : 0 },
      { subject: "Legs", sets: sets.Legs, volume: Math.round(volume.Legs), pctSets: totalSets ? Math.round((sets.Legs / totalSets) * 100) : 0, pctVolume: totalVolume ? Math.round((volume.Legs / totalVolume) * 100) : 0 },
    ];
  }, [muscleVolumeLogs]);

  // ---- RPE trend ----
  const rpeSeries = useMemo(() => {
    const bySession = {};
    const logsInRange = trendBaseLogs.filter(r => new Date(r.completed_at) >= cutoff);
    
    logsInRange.forEach((r) => {
      const key = r.completed_at.slice(0, 10);
      bySession[key] = bySession[key] || { sum: 0, n: 0, date: r.completed_at };
      bySession[key].sum += r.rpe || 0;
      bySession[key].n += 1;
    });
    return Object.values(bySession)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((s) => ({ date: fmtDate(s.date), rpe: Math.round((s.sum / s.n) * 10) / 10 }));
  }, [trendBaseLogs, cutoff]);

  // ---- Sorted table logs for records table ----
  const tableLogs = useMemo(() => {
    if (dateFilterMode === "custom") {
      return exerciseFilteredLogs.filter(r => selectedDates.includes(r.completed_at.slice(0, 10)));
    }
    return exerciseFilteredLogs.filter(r => new Date(r.completed_at) >= cutoff && new Date(r.completed_at) <= anchorDate);
  }, [exerciseFilteredLogs, dateFilterMode, selectedDates, cutoff, anchorDate]);

  const sortedTableLogs = useMemo(() => {
    const items = [...tableLogs];
    if (!sortColumn) return items;
    
    items.sort((a, b) => {
      let valA, valB;
      
      switch (sortColumn) {
        case "completed_at":
          valA = new Date(a.completed_at).getTime();
          valB = new Date(b.completed_at).getTime();
          break;
        case "title":
          valA = (a.title || a.work_id || "").toLowerCase();
          valB = (b.title || b.work_id || "").toLowerCase();
          break;
        case "muscle_group":
          valA = (a.muscle_group || "General").toLowerCase();
          valB = (b.muscle_group || "General").toLowerCase();
          break;
        case "weight_kg":
          valA = a.weight_kg ?? 0;
          valB = b.weight_kg ?? 0;
          break;
        case "reps":
          valA = a.reps ?? 0;
          valB = b.reps ?? 0;
          break;
        case "rpe":
          valA = a.rpe ?? 0;
          valB = b.rpe ?? 0;
          break;
        case "est1rm":
          valA = estOneRM(a.weight_kg, a.reps);
          valB = estOneRM(b.weight_kg, b.reps);
          break;
        default:
          valA = 0;
          valB = 0;
      }
      
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return items;
  }, [tableLogs, sortColumn, sortDirection]);

  const recentSets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTableLogs.slice(start, start + pageSize);
  }, [sortedTableLogs, currentPage, pageSize]);

  // ---- AI Decision Page calculations ----
  
  // 1. Recovery Countdown from latest workout log
  const latestLog = useMemo(() => {
    if (!rawLogs.length) return null;
    return rawLogs.reduce((latest, r) => {
      if (!latest) return r;
      return new Date(r.completed_at) > new Date(latest.completed_at) ? r : latest;
    }, null);
  }, [rawLogs]);

  const recoveryDetails = useMemo(() => {
    if (!latestLog) return null;

    const rpe = latestLog.rpe || 7;
    const restHours = getRecoveryHours(latestLog.muscle_group, rpe);

    const completedTime = new Date(latestLog.completed_at);
    const targetTime = new Date(completedTime.getTime() + restHours * 60 * 60 * 1000);
    const totalDurationMs = restHours * 60 * 60 * 1000;

    return {
      rpe,
      restHours,
      completedTime,
      targetTime,
      totalDurationMs
    };
  }, [latestLog]);

  const recoveryStatus = useMemo(() => {
    if (!recoveryDetails) return null;
    
    const timeRemainingMs = recoveryDetails.targetTime - now;
    const isRecovered = timeRemainingMs <= 0;
    
    const elapsedMs = now - recoveryDetails.completedTime;
    const pct = Math.min(100, Math.max(0, Math.round((elapsedMs / recoveryDetails.totalDurationMs) * 100)));
    
    let countdownStr = "";
    if (!isRecovered) {
      const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
      const mins = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((timeRemainingMs % (1000 * 60)) / 1000);
      countdownStr = `${hours}h ${mins}m ${secs}s`;
    }

    return {
      isRecovered,
      pct,
      countdownStr,
      timeRemainingMs
    };
  }, [recoveryDetails, now]);

  // 2. Muscle Recovery & Priorities Recommendation (using per-muscle base recovery times, secondary-aware)
  const musclePriorities = useMemo(() => {
    if (!expandedStimulus.length) return { fullyRecovered: [], recovering: [], recommended: null };
    
    const muscles = [...new Set(expandedStimulus.map(s => s.stimulus_muscle).filter(Boolean))];
    
    const muscleStatus = muscles.map(muscle => {
      const muscleEvents = expandedStimulus.filter(s => s.stimulus_muscle === muscle);
      const latestMuscleEvent = muscleEvents.reduce((latest, s) => {
        if (!latest) return s;
        return new Date(s.completed_at) > new Date(latest.completed_at) ? s : latest;
      }, null);
      
      const lastTrained = new Date(latestMuscleEvent.completed_at);
      const hoursSince = (now - lastTrained) / (1000 * 60 * 60);
      const daysSince = Math.round((hoursSince / 24) * 10) / 10;
      
      const role = latestMuscleEvent.role;
      const contribution = latestMuscleEvent.contribution != null ? latestMuscleEvent.contribution : 1.0;
      const baseRestHours = getRecoveryHours(muscle, latestMuscleEvent.rpe || 7);
      const restHours = baseRestHours * (role === 'secondary' ? Math.max(contribution, 0.5) : 1);
      
      const isRecovered = hoursSince >= restHours;
      const hoursRemaining = Math.max(0, restHours - hoursSince);
      
      return {
        muscle,
        lastTrained,
        hoursSince,
        daysSince,
        isRecovered,
        hoursRemaining,
        restHours
      };
    });

    const fullyRecovered = muscleStatus
      .filter(m => m.isRecovered)
      .sort((a, b) => b.hoursSince - a.hoursSince);
      
    const recovering = muscleStatus
      .filter(m => !m.isRecovered)
      .sort((a, b) => a.hoursRemaining - b.hoursRemaining);
      
    return {
      fullyRecovered,
      recovering,
      recommended: fullyRecovered.length > 0 ? fullyRecovered[0] : (recovering.length > 0 ? recovering[0] : null)
    };
  }, [expandedStimulus, now]);

  // 3a. Selected Exercise Plateau Status (for Insights tab Overload chart banner)
  const selectedExercisePlateauStatus = useMemo(() => {
    if (selectedExerciseId === "all") {
      return { isPlateaued: false, sessionsFlat: 0, sinceDate: null };
    }
    return detectPlateau(oneRmSeries, 5, 0.015);
  }, [oneRmSeries, selectedExerciseId]);

  // 3b. Fatigue Info (replaces old aiDecisionProjections)
  const fatigueInfo = useMemo(() => {
    if (!musclePriorities.recommended) return null;
    
    const recommendedMuscle = musclePriorities.recommended.muscle;
    const muscleLogs = expandedStimulus.filter(s => s.stimulus_muscle === recommendedMuscle);
    if (!muscleLogs.length) return null;
    
    const latestExerciseLog = muscleLogs.reduce((latest, r) => {
      if (!latest) return r;
      return new Date(r.completed_at) > new Date(latest.completed_at) ? r : latest;
    }, null);
    
    const exerciseName = latestExerciseLog.title || latestExerciseLog.work_id;
    const lastWeight = latestExerciseLog.weight_kg ?? 0;
    const lastReps = latestExerciseLog.reps ?? 0;
    
    let fatigueLevel = "Optimal";
    let fatigueColor = "#4FD1C5";
    let fatigueDetails = "Your workload volume is within the sweet spot. Recovery is optimal.";
    
    if (currentAcwr > 1.5) {
      fatigueLevel = "High Danger Zone";
      fatigueColor = "#EF7B57";
      fatigueDetails = "Acute load is significantly higher than chronic. High fatigue predicted. Suggest a deload session (reduce weight by 30%).";
    } else if (currentAcwr >= 1.3) {
      fatigueLevel = "Caution/Elevated";
      fatigueColor = "#F4B740";
      fatigueDetails = "Workload is elevated. Muscle soreness predicted. Keep weight constant, do not overload.";
    } else if (currentAcwr < 0.8) {
      fatigueLevel = "Under-stimulated";
      fatigueColor = "#7FA6FF";
      fatigueDetails = "Low overall workload. Recovery is full, but stimulus is low. Ready for intense overload.";
    }
    
    return {
      exerciseName,
      lastWeight,
      lastReps,
      fatigueLevel,
      fatigueColor,
      fatigueDetails
    };
  }, [musclePriorities.recommended, expandedStimulus, currentAcwr]);

  const recentSecondaryStimulus = useMemo(() => {
    const recommendedMuscleName = musclePriorities.recommended?.muscle;
    if (!recommendedMuscleName || !expandedStimulus.length) return [];
    
    const fortyEightHoursAgo = new Date(anchorDate.getTime() - 48 * 60 * 60 * 1000);
    
    return expandedStimulus
      .filter(s => 
        s.role === 'secondary' && 
        s.stimulus_muscle === recommendedMuscleName && 
        new Date(s.completed_at) >= fortyEightHoursAgo
      )
      .map(s => {
        const hoursAgo = Math.round((anchorDate - new Date(s.completed_at)) / (1000 * 60 * 60) * 10) / 10;
        return {
          muscle: s.stimulus_muscle,
          hoursAgo,
          viaExercise: s.title || s.work_id
        };
      });
  }, [expandedStimulus, musclePriorities.recommended, anchorDate]);

  // 4a. Recommended-scoped exercise logs (independent of selectedExerciseId)
  const recommendedExerciseLogs = useMemo(() => {
    if (!fatigueInfo?.exerciseName || !rawLogs.length) return [];
    const exerciseLower = fatigueInfo.exerciseName.trim().toLowerCase();
    return rawLogs.filter(r => (r.title || r.work_id || "").trim().toLowerCase() === exerciseLower);
  }, [rawLogs, fatigueInfo?.exerciseName]);

  // 4b. Recommended-scoped exercise 1RM series (independent of selectedExerciseId)
  const recommendedOneRmSeries = useMemo(() => {
    const logsBeforeAnchor = recommendedExerciseLogs.filter(r => new Date(r.completed_at) <= anchorDate);
    const fullSeries = buildOneRmSeries(logsBeforeAnchor, false);
    return fullSeries.filter(p => new Date(p.rawDate) >= cutoff);
  }, [recommendedExerciseLogs, anchorDate, cutoff]);

  // 4c. Recommended Exercise Plateau Status (for Decision tab / Gemini prompt)
  const recommendedExercisePlateauStatus = useMemo(() => {
    if (!fatigueInfo?.exerciseName) {
      return { isPlateaued: false, sessionsFlat: 0, sinceDate: null };
    }
    return detectPlateau(recommendedOneRmSeries, 5, 0.015);
  }, [recommendedOneRmSeries, fatigueInfo?.exerciseName]);

  // 4d. Recommended Exercise Injury Risk (for Decision tab / Gemini prompt)
  const recommendedExerciseInjuryRisk = useMemo(() => {
    if (!fatigueInfo?.exerciseName) {
      return { level: "none", reason: "" };
    }
    return detectInjuryRisk(recommendedExerciseLogs);
  }, [recommendedExerciseLogs, fatigueInfo?.exerciseName]);

  // 6. LLM Coaching integration with rate-limit loop prevention
  const recommendedMuscleName = musclePriorities.recommended?.muscle;
  const isMuscleRecovered = musclePriorities.recommended?.isRecovered;
  const isPlateaued = recommendedExercisePlateauStatus.isPlateaued;
  const plateauSessions = recommendedExercisePlateauStatus.sessionsFlat;
  const injuryRiskLevel = recommendedExerciseInjuryRisk.level;
  const exerciseName = fatigueInfo?.exerciseName;
  const lastWeight = fatigueInfo?.lastWeight;
  const lastReps = fatigueInfo?.lastReps;
  const fatigueLevel = fatigueInfo?.fatigueLevel;

  useEffect(() => {
    if (!fatigueInfo || !recommendedMuscleName) {
      setAiCoaching(null);
      return;
    }
    
    let active = true;
    
    const fetchCoaching = async () => {
      setAiCoachingLoading(true);
      try {
        const response = await fetch("/api/coaching-recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendedMuscle: recommendedMuscleName,
            isRecovered: isMuscleRecovered,
            acwr: currentAcwr,
            acwrZoneLabel: fatigueLevel,
            recentRpeTrend: rpeSeries.slice(-5).map(s => s.rpe),
            plateauStatus: recommendedExercisePlateauStatus,
            injuryRiskFlag: recommendedExerciseInjuryRisk,
            lastSession: {
              exerciseName,
              weight: lastWeight,
              reps: lastReps,
            },
            fullyRecoveredMuscles: musclePriorities.fullyRecovered.map(m => m.muscle),
            recoveringMuscles: musclePriorities.recovering.map(m => m.muscle),
            recentSecondaryStimulus,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }
        
        const data = await response.json();
        if (active) {
          setAiCoaching(data);
        }
      } catch (err) {
        console.error("Failed to load AI coaching recommendation:", err);
        if (active) {
          setAiCoaching(null);
        }
      } finally {
        if (active) {
          setAiCoachingLoading(false);
        }
      }
    };
    
    // De-bounce/throttling guard: wait 100ms to confirm no rapid state transitions are occurring
    const timer = setTimeout(() => {
      fetchCoaching();
    }, 100);
    
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    recommendedMuscleName,
    isMuscleRecovered,
    currentAcwr,
    fatigueLevel,
    isPlateaued,
    plateauSessions,
    injuryRiskLevel,
    exerciseName,
    lastWeight,
    lastReps,
    JSON.stringify(recentSecondaryStimulus)
  ]);

  // ---- Block Suggestions calculation and API call ----
  const consecutivePlateauCount = useMemo(() => {
    if (!recommendedOneRmSeries || recommendedOneRmSeries.length < 5) return 0;
    let count = 0;
    for (let i = 0; i < 3; i++) {
      const slice = i === 0 ? recommendedOneRmSeries : recommendedOneRmSeries.slice(0, -i);
      const plat = detectPlateau(slice, 5, 0.015);
      if (plat.isPlateaued) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [recommendedOneRmSeries]);

  const recentInjuryRiskCount = useMemo(() => {
    if (!recommendedExerciseLogs || recommendedExerciseLogs.length === 0) return 0;
    
    // Group logs by date
    const dates = [...new Set(recommendedExerciseLogs.map(r => r.completed_at?.slice(0, 10)).filter(Boolean))].sort();
    if (dates.length < 3) return 0;
    
    let watchOrElevatedCount = 0;
    for (let i = 0; i < 3; i++) {
      const activeDates = dates.slice(0, dates.length - i);
      const filteredLogs = recommendedExerciseLogs.filter(r => activeDates.includes(r.completed_at?.slice(0, 10)));
      const risk = detectInjuryRisk(filteredLogs);
      if (risk.level === 'watch' || risk.level === 'elevated') {
        watchOrElevatedCount++;
      }
    }
    return watchOrElevatedCount;
  }, [recommendedExerciseLogs]);

  const weeksSinceDeload = useMemo(() => {
    if (!weeklyStats || weeklyStats.length === 0) return null;
    const reversed = [...weeklyStats].reverse();
    const deloadIdx = reversed.findIndex(w => w.isDeload);
    return deloadIdx === -1 ? null : deloadIdx;
  }, [weeklyStats]);

  const recentSecondaryStimulusCount = useMemo(() => {
    if (!expandedStimulus.length) return 0;
    const fourWeeksAgo = new Date(anchorDate.getTime() - 28 * 24 * 60 * 60 * 1000);
    return expandedStimulus.filter(s => s.role === 'secondary' && new Date(s.completed_at) >= fourWeeksAgo).length;
  }, [expandedStimulus, anchorDate]);

  const blockContext = useMemo(() => {
    const last4Weeks = weeklyStats.slice(-4);
    const acwrTrajectory = last4Weeks.map(w => ({
      weekIndex: w.weekIndex,
      acwr: w.acwr,
      volume: w.volume,
      isDeload: w.isDeload,
      date: w.date
    }));
    
    return {
      acwrTrajectory,
      consecutivePlateaus: consecutivePlateauCount,
      recentInjuryRisks: recentInjuryRiskCount,
      weeksSinceDeload: weeksSinceDeload,
      recommendedMuscle: fatigueInfo?.exerciseName || "Overall",
      secondaryStimulusCount: recentSecondaryStimulusCount
    };
  }, [weeklyStats, consecutivePlateauCount, recentInjuryRiskCount, weeksSinceDeload, fatigueInfo, recentSecondaryStimulusCount]);

  useEffect(() => {
    if (!blockContext || weeklyStats.length < 3) {
      setBlockAssessment(null);
      return;
    }

    let active = true;

    const fetchBlockAssessment = async () => {
      setBlockAssessmentLoading(true);
      try {
        const response = await fetch("/api/block-assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(blockContext),
        });

        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }

        const data = await response.json();
        if (active) {
          setBlockAssessment(data);
        }
      } catch (err) {
        console.error("Failed to load AI block assessment:", err);
        if (active) {
          setBlockAssessment(null);
        }
      } finally {
        if (active) {
          setBlockAssessmentLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchBlockAssessment();
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [JSON.stringify(blockContext), weeklyStats.length]);

  const attemptedClassifications = useRef(new Set());

  useEffect(() => {
    if (!rawLogs.length || muscleMapRows === null) return;

    const runClassification = async () => {
      const uniqueTitles = [...new Set(rawLogs.map(r => r.title || r.work_id).filter(Boolean))];
      const missingTitles = uniqueTitles.filter(title => !muscleMapLookup.has(title));

      for (const title of missingTitles) {
        if (attemptedClassifications.current.has(title)) continue;
        attemptedClassifications.current.add(title);

        console.log(`Auto-classifying missing exercise: "${title}"`);
        const logWithTitle = rawLogs.find(r => (r.title || r.work_id) === title);
        const existingPrimary = logWithTitle ? logWithTitle.muscle_group : null;

        try {
          const response = await fetch("/api/classify-exercise-muscles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, existingPrimary })
          });

          if (!response.ok) {
            throw new Error(`Failed to classify exercise: status ${response.status}`);
          }

          const result = await response.json();
          const rowsToInsert = [
            {
              exercise_key: title,
              muscle_group: result.primary_muscle,
              role: 'primary',
              contribution: 1.0
            },
            ...result.secondary_muscles.map(sm => ({
              exercise_key: title,
              muscle_group: sm.muscle_group,
              role: 'secondary',
              contribution: sm.contribution
            }))
          ];

          const { error: insertError } = await supabase
            .from('exercise_muscle_map')
            .insert(rowsToInsert);

          if (insertError) {
            throw insertError;
          }

          console.log(`Successfully classified and stored muscle mapping for "${title}":`, rowsToInsert);
          setMuscleMapRows(prev => [...(prev || []), ...rowsToInsert]);
        } catch (err) {
          console.error(`Failed to auto-classify exercise "${title}":`, err);
        }
      }
    };

    runClassification();
  }, [rawLogs, muscleMapLookup, muscleMapRows]);

  const toggleDate = (date) => {
    if (dateFilterMode === "all") {
      setDateFilterMode("custom");
      setSelectedDates([date]);
    } else {
      setSelectedDates((prev) =>
        prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
      );
    }
  };

  const selectAllDates = () => {
    setDateFilterMode("all");
    setSelectedDates([]);
  };

  const clearSelectedDates = () => {
    setDateFilterMode("custom");
    setSelectedDates([]);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-[#0C0E12] text-[#E7E9EC] flex flex-col items-center justify-center gap-3 text-sm">
        <RefreshCw className="animate-spin text-[#F4B740]" size={24} />
        <p>Connecting to Supabase and loading workout logs...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="w-full min-h-screen bg-[#0C0E12] text-[#E7E9EC] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-[#15181D] border border-red-500/30 rounded-xl p-6 space-y-3">
          <p className="text-red-400 font-semibold text-lg">Database Error</p>
          <p className="text-xs text-[#8A919C]">{errorMsg}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 text-xs bg-[#F4B740] text-[#0C0E12] font-semibold rounded-lg hover:opacity-90"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full text-[#E7E9EC]" style={{ background: "#0C0E12", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Click outside overlay for custom dropdowns */}
      {(dateDropdownOpen || exerciseDropdownOpen) && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => {
            setDateDropdownOpen(false);
            setExerciseDropdownOpen(false);
          }}
        />
      )}

      <div className="max-w-5xl mx-auto p-5 md:p-8 space-y-6 relative">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F4B740]/10 border border-[#F4B740]/30 flex items-center justify-center">
              <Dumbbell size={20} color="#F4B740" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>
                TRAINING LOG
              </h1>
              <p className="text-xs text-[#8A919C]">
                Loaded <span className="text-[#F4B740] font-medium">{rawLogs.length}</span> rows from Supabase
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 relative z-20">
            {/* Global Workout Filter Dropdown */}
            <div className="relative z-20">
              <button
                onClick={() => {
                  setExerciseDropdownOpen(!exerciseDropdownOpen);
                  setDateDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 text-xs text-[#8A919C] border border-[#232830] hover:border-[#3A414C] bg-[#15181D] rounded-lg px-3 py-2 transition-colors min-w-[150px] justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Dumbbell size={13} color="#F4B740" />
                  <span className="truncate max-w-[120px]">
                    {selectedExerciseId === "all" ? "All Workouts" : activeExercise.title}
                  </span>
                </div>
                <ChevronDown size={13} />
              </button>
              {exerciseDropdownOpen && (
                <div className="absolute right-0 mt-1 w-56 rounded-lg border border-[#232830] bg-[#1B1F26] shadow-xl z-30 overflow-hidden max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedExerciseId("all");
                      setExerciseDropdownOpen(false);
                    }}
                    className={`block w-full text-left px-3 py-2 text-xs hover:bg-[#232830] font-medium ${
                      selectedExerciseId === "all" ? "text-[#F4B740]" : "text-[#E7E9EC]"
                    }`}
                  >
                    All Workouts
                  </button>
                  {exercisesList.map((e) => (
                    <button
                      key={e.work_id}
                      onClick={() => {
                        setSelectedExerciseId(e.work_id);
                        setExerciseDropdownOpen(false);
                      }}
                      className={`block w-full text-left px-3 py-2 text-xs hover:bg-[#232830] ${
                        selectedExerciseId === e.work_id ? "text-[#F4B740]" : "text-[#E7E9EC]"
                      }`}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Multi-Select Date Dropdown */}
            <div className="relative z-20">
              <button
                onClick={() => {
                  setDateDropdownOpen(!dateDropdownOpen);
                  setExerciseDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 text-xs text-[#8A919C] border border-[#232830] hover:border-[#3A414C] bg-[#15181D] rounded-lg px-3 py-2 transition-colors min-w-[130px] justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <CalendarCheck size={13} color="#F4B740" />
                  <span>
                    {dateFilterMode === "all"
                      ? "All Dates"
                      : selectedDates.length === 0
                      ? "No Dates Selected"
                      : selectedDates.length === 1
                      ? selectedDates[0]
                      : `${selectedDates.length} Dates`}
                  </span>
                </div>
                <ChevronDown size={13} />
              </button>
              {dateDropdownOpen && (
                <div className="absolute right-0 mt-1 w-60 rounded-lg border border-[#232830] bg-[#1B1F26] shadow-xl z-30 overflow-hidden">
                  <div className="p-2 border-b border-[#232830] flex gap-2 justify-between bg-[#15181D]">
                    <button
                      onClick={selectAllDates}
                      className="flex-1 text-[10px] bg-[#232830] hover:bg-[#3A414C] text-[#E7E9EC] font-medium py-1 px-1.5 rounded transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearSelectedDates}
                      className="flex-1 text-[10px] bg-[#232830] hover:bg-[#3A414C] text-[#E7E9EC] font-medium py-1 px-1.5 rounded transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-2 space-y-1 bg-[#1B1F26]">
                    {uniqueDates.map((date) => {
                      const isChecked = dateFilterMode === "all" || selectedDates.includes(date);
                      return (
                        <label
                          key={date}
                          className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-[#232830] rounded cursor-pointer select-none text-[#E7E9EC] font-mono"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDate(date)}
                            className="rounded border-[#232830] bg-[#0C0E12] text-[#F4B740] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <span>{date}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Date Range Selector */}
            <div className="flex rounded-lg border border-[#232830] overflow-hidden bg-[#15181D]">
              {PERIODS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setPeriodIdx(i)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    i === periodIdx ? "bg-[#F4B740] text-[#0C0E12]" : "text-[#8A919C] hover:text-[#E7E9EC]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              onClick={loadData}
              className="flex items-center gap-1.5 text-xs text-[#8A919C] border border-[#232830] hover:border-[#3A414C] bg-[#15181D] rounded-lg px-3 py-2 transition-colors"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={() => exportToCSV(sortedTableLogs, selectedExerciseId === "all" ? "all-workouts" : activeExercise.title)}
              className="flex items-center gap-1.5 text-xs text-[#8A919C] border border-[#232830] hover:border-[#3A414C] bg-[#15181D] rounded-lg px-3 py-2 transition-colors"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-1.5 text-xs text-[#8A919C] border border-[#232830] hover:border-[#3A414C] bg-[#15181D] rounded-lg px-3 py-2 transition-colors"
            >
              <Database size={13} /> Status
            </button>
          </div>
        </div>

        {rawLogs.length === 0 ? (
          <div className="rounded-xl border border-[#232830] bg-[#15181D] p-8 text-center space-y-2">
            <p className="text-base font-semibold">No rows found in `workout_log` table</p>
            <p className="text-xs text-[#8A919C]">
              Your database returned 0 rows. Add records to your Supabase table or check your Row Level Security (RLS) policies.
            </p>
          </div>
        ) : (
          <>
            {/* Tab Selection */}
            <div className="flex border-b border-[#232830] gap-4">
              <button
                onClick={() => setActiveTab("insights")}
                className={`pb-2.5 text-sm font-semibold tracking-wide border-b-2 transition-all ${
                  activeTab === "insights"
                    ? "border-[#F4B740] text-[#F4B740]"
                    : "border-transparent text-[#8A919C] hover:text-[#E7E9EC]"
                }`}
              >
                Insights Dashboard
              </button>
              <button
                onClick={() => setActiveTab("decision")}
                className={`pb-2.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "decision"
                    ? "border-[#F4B740] text-[#F4B740]"
                    : "border-transparent text-[#8A919C] hover:text-[#E7E9EC]"
                }`}
              >
                <Brain size={14} /> AI Decision Engine
              </button>
              <button
                onClick={() => setActiveTab("body")}
                className={`pb-2.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "body"
                    ? "border-[#F4B740] text-[#F4B740]"
                    : "border-transparent text-[#8A919C] hover:text-[#E7E9EC]"
                }`}
              >
                <Scale size={14} /> Body Composition
              </button>
              <button
                onClick={() => setActiveTab("program")}
                className={`pb-2.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "program"
                    ? "border-[#F4B740] text-[#F4B740]"
                    : "border-transparent text-[#8A919C] hover:text-[#E7E9EC]"
                }`}
              >
                <CalendarCheck size={14} /> Training Program
              </button>
            </div>

            {/* Insights View */}
            {activeTab === "insights" && (
              <InsightsTab
                totalVolume={totalVolume}
                volumeDelta={volumeDelta}
                selectedExerciseId={selectedExerciseId}
                activeExercise={activeExercise}
                currentBest1RM={currentBest1RM}
                oneRmDelta={oneRmDelta}
                avgRpe={avgRpe}
                rpeDelta={rpeDelta}
                sessionsCount={sessionsCount}
                sessionsDelta={sessionsDelta}
                overallProgressRateStats={overallProgressRateStats}
                currentAcwr={currentAcwr}
                acwrInfo={acwrInfo}
                radarChartData={radarChartData}
                radarMetric={radarMetric}
                setRadarMetric={setRadarMetric}
                volumeByMuscleGroupData={volumeByMuscle}
                rpeSeries={rpeSeries}
                oneRmSeries={oneRmSeries}
                selectedExercisePlateauStatus={selectedExercisePlateauStatus}
                visibleWeeklyStats={visibleWeeklyStats}
                recentSets={recentSets}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
                sortedTableLogs={sortedTableLogs}
                dailyFatigueMap={dailyFatigueMap}
                anchorDate={anchorDate}
                muscleMapLookup={muscleMapLookup}
                handleSort={handleSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                exportToCSV={exportToCSV}
              />
            )}

            {/* AI Decision Engine View */}
            {activeTab === "decision" && (
              <DecisionTab
                recoveryStatus={recoveryStatus}
                aiCoachingLoading={aiCoachingLoading}
                aiCoaching={aiCoaching}
                musclePriorities={musclePriorities}
                blockAssessmentLoading={blockAssessmentLoading}
                blockAssessment={blockAssessment}
                weeklyStats={weeklyStats}
                fatigueInfo={fatigueInfo}
                trainingGoals={trainingGoals}
                onRefreshGoals={loadData}
                exercisesList={exercisesList}
                bodyMetrics={bodyMetrics}
              />
            )}

            {activeTab === "body" && (
              <BodyCompositionTab 
                bodyMetrics={bodyMetrics} 
                onRefresh={loadData}
              />
            )}

            {activeTab === "program" && (
              <ProgramTab
                programsWithDays={programsWithDays}
                exercisesList={exercisesList}
                rawLogs={rawLogs}
                onRefresh={loadData}
              />
            )}
          </>
        )}
      </div>

      {/* Setup Modal */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowSetup(false)}>
          <div className="max-w-lg w-full rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Database size={15} color="#F4B740" /> Database Status
              </h3>
              <button onClick={() => setShowSetup(false)}>
                <X size={16} color="#8A919C" />
              </button>
            </div>
            <p className="text-xs text-[#8A919C]">
              Connected to <code className="text-[#E7E9EC]">workout_log</code> with <span className="text-green-400 font-semibold">{rawLogs.length}</span> active records loaded.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
