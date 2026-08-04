import { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from "recharts";
import {
  Dumbbell, TrendingUp, TrendingDown, Flame, CalendarCheck,
  ChevronDown, Trophy, Database, X, Activity, Rocket, Gauge, Timer, RefreshCw,
  Brain, CheckCircle2, AlertTriangle, ChevronRight, AlertOctagon, Download, ChevronLeft
} from "lucide-react";

import { getRecoveryHours } from "./utils/recovery";
import { detectPlateau, detectInjuryRisk } from "./utils/analysis";
import { exportToCSV } from "./utils/csv";

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
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

const WEEKS = 10;

function estOneRM(weight, reps) {
  if (!weight || !reps) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function linregSlope(points) {
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

const MUSCLE_COLORS = {
  abdominals: "#EC4899",
  abductors: "#A855F7",
  adductors: "#8B5CF6",
  biceps: "#3B82F6",
  calves: "#06B6D4",
  chest: "#F4B740",
  full_body: "#10B981",
  hamstrings: "#14B8A6",
  lats: "#EF7B57",
  quadriceps: "#4FD1C5",
  shoulders: "#7FA6FF",
  traps: "#F97316",
  triceps: "#6366F1",
  upper_back: "#E11D48",
};

const PERIODS = [
  { label: "7D", days: 7 },
  { label: "1M", days: 30 },
  { label: "All", days: null }
];

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function acwrZone(v) {
  if (v < 0.8) return { label: "Low stimulus", color: "#7FA6FF" };
  if (v <= 1.3) return { label: "Sweet spot", color: "#4FD1C5" };
  if (v <= 1.5) return { label: "Caution", color: "#F4B740" };
  return { label: "High risk", color: "#EF7B57" };
}

function buildOneRmSeries(rows, isAllExercises = false) {
  const bySession = {};
  rows.forEach((r) => {
    const calculated1RM = r.best_1rm || estOneRM(r.weight_kg, r.reps);
    if (isAllExercises) {
      const dateKey = r.completed_at.slice(0, 10);
      if (!bySession[dateKey]) {
        bySession[dateKey] = { completed_at: r.completed_at, oneRms: [] };
      }
      bySession[dateKey].oneRms.push(calculated1RM);
    } else {
      const key = r.set_id ? r.set_id.split("-s")[0] : `${r.work_id || r.title}-${r.completed_at}`;
      if (!bySession[key] || calculated1RM > (bySession[key]._calc1RM || 0)) {
        bySession[key] = { ...r, _calc1RM: calculated1RM };
      }
    }
  });

  const sorted = Object.values(bySession).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
  let runningMax = 0;
  return sorted.map((item) => {
    if (isAllExercises) {
      const avg1Rm = Math.round((item.oneRms.reduce((sum, val) => sum + val, 0) / item.oneRms.length) * 10) / 10;
      const isPR = avg1Rm > runningMax;
      if (isPR) runningMax = avg1Rm;
      return { rawDate: item.completed_at, date: fmtDate(item.completed_at), oneRm: avg1Rm, isPR };
    } else {
      const isPR = item._calc1RM > runningMax;
      if (isPR) runningMax = item._calc1RM;
      return { rawDate: item.completed_at, date: fmtDate(item.completed_at), oneRm: item._calc1RM, isPR, weekIndex: item._weekIndex };
    }
  });
}

function KpiCard({ icon: Icon, label, value, unit, delta, accent }) {
  const up = delta >= 0;
  return (
    <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#8A919C]">{label}</span>
        <Icon size={16} color={accent} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[28px] leading-none font-semibold tabular-nums" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {value}
        </span>
        {unit && <span className="text-xs text-[#8A919C]">{unit}</span>}
      </div>
      {delta !== null && delta !== undefined && !isNaN(delta) && (
        <div className={`flex items-center gap-1 text-xs ${up ? "text-[#4FD1C5]" : "text-[#EF7B57]"}`}>
          {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          <span>{Math.abs(delta).toFixed(1)}% vs prior period</span>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, unit, accent, subtitle, subtitleColor }) {
  return (
    <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#8A919C]">{label}</span>
        <Icon size={16} color={accent} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[28px] leading-none font-semibold tabular-nums" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {value}
        </span>
        {unit && <span className="text-xs text-[#8A919C]">{unit}</span>}
      </div>
      {subtitle && <div className="text-xs" style={{ color: subtitleColor || "#8A919C" }}>{subtitle}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label, suffix }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-[#2A2F38] bg-[#1B1F26] px-3 py-2 text-xs shadow-lg">
      <div className="text-[#8A919C] mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#E7E9EC]">
            {p.name}: {p.value}
            {suffix || ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function WorkoutDashboard() {
  const [activeTab, setActiveTab] = useState("insights"); // "insights" or "decision"
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

  // Reset pagination on filter/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedExerciseId, dateFilterMode, selectedDates, periodIdx, sortColumn, sortDirection]);

  const [rawLogs, setRawLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await fetchWorkoutLogs();
      console.log("Raw Supabase Data Loaded:", data);
      
      // Sanitize logs: filter out invalid/empty rows and normalize workout_id
      const sanitized = (data || [])
        .filter((r) => r.completed_at)
        .map((r) => ({
          ...r,
          work_id: r.workout_id || r.work_id,
        }));

      setRawLogs(sanitized);
    } catch (err) {
      console.error("Failed to load workout logs from Supabase:", err);
      setErrorMsg(err.message || "Failed to load database rows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  // 2. Muscle Recovery & Priorities Recommendation (using per-muscle base recovery times)
  const musclePriorities = useMemo(() => {
    if (!rawLogs.length) return { fullyRecovered: [], recovering: [], recommended: null };
    
    const muscles = [...new Set(rawLogs.map(r => r.muscle_group).filter(Boolean))];
    
    const muscleStatus = muscles.map(muscle => {
      const muscleLogs = rawLogs.filter(r => r.muscle_group === muscle);
      const latestMuscleLog = muscleLogs.reduce((latest, r) => {
        if (!latest) return r;
        return new Date(r.completed_at) > new Date(latest.completed_at) ? r : latest;
      }, null);
      
      const lastTrained = new Date(latestMuscleLog.completed_at);
      const hoursSince = (now - lastTrained) / (1000 * 60 * 60);
      const daysSince = Math.round((hoursSince / 24) * 10) / 10;
      
      const restHours = getRecoveryHours(muscle, latestMuscleLog.rpe || 7);
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
  }, [rawLogs, now]);

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
    const muscleLogs = rawLogs.filter(r => r.muscle_group === recommendedMuscle);
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
  }, [musclePriorities.recommended, rawLogs, currentAcwr]);

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
    lastReps
  ]);

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
            </div>

            {/* Insights View */}
            {activeTab === "insights" && (
              <>
                {/* KPI Row 1 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-0">
                  <KpiCard icon={Flame} label="Total Volume" value={Math.round(totalVolume).toLocaleString()} unit="kg" delta={volumeDelta} accent="#F4B740" />
                  <KpiCard
                    icon={Trophy}
                    label={selectedExerciseId === "all" ? "Best 1RM · Overall" : `Best 1RM · ${activeExercise.title}`}
                    value={currentBest1RM}
                    unit="kg"
                    delta={oneRmDelta}
                    accent="#EF7B57"
                  />
                  <KpiCard icon={Activity} label="Avg RPE" value={avgRpe.toFixed(1)} unit="/ 10" delta={rpeDelta} accent="#7FA6FF" />
                  <KpiCard icon={CalendarCheck} label="Sessions Logged" value={sessionsCount} unit="" delta={sessionsDelta} accent="#4FD1C5" />
                </div>

                {/* KPI Row 2 — training-science metrics */}
                <div className="relative z-0">
                  <p className="text-[11px] uppercase tracking-wider text-[#8A919C] mb-2">Load &amp; Recovery</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <MetricCard
                      icon={Rocket}
                      label={selectedExerciseId === "all" ? "Progress Rate · Overall" : `Progress Rate · ${activeExercise.title}`}
                      value={`${overallProgressRateStats.slope >= 0 ? "+" : ""}${overallProgressRateStats.slope.toFixed(1)}`}
                      unit="kg/session"
                      accent={overallProgressRateStats.slope >= 0 ? "#4FD1C5" : "#EF7B57"}
                      subtitle={`${overallProgressRateStats.slopePct >= 0 ? "+" : ""}${overallProgressRateStats.slopePct.toFixed(1)}% trajectory`}
                      subtitleColor={overallProgressRateStats.slope >= 0 ? "#4FD1C5" : "#EF7B57"}
                    />
                    <MetricCard
                      icon={Gauge}
                      label="ACWR (Latest Week)"
                      value={currentAcwr.toFixed(2)}
                      unit=""
                      accent={acwrInfo.color}
                      subtitle={acwrInfo.label}
                      subtitleColor={acwrInfo.color}
                    />
                  </div>
                </div>

                {/* Volume & RPE Trend Grid (Moved UP below KPIs) */}
                <div className="grid md:grid-cols-2 gap-6 relative z-0">
                  {/* Volume by muscle group */}
                  <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
                    <h2 className="text-sm font-semibold mb-1">Volume by Muscle Group</h2>
                    <p className="text-xs text-[#8A919C] mb-4">Weekly kg lifted across categories</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={volumeByMuscle} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid stroke="#1E222A" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#8A919C", fontSize: 10 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
                        <YAxis tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip suffix=" kg" />} />
                        {muscleGroups.map((mg) => (
                          <Bar key={mg} dataKey={mg} stackId="vol" fill={MUSCLE_COLORS[mg] || "#8A919C"} radius={[2, 2, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* RPE trend */}
                  <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
                    <h2 className="text-sm font-semibold mb-1">Fatigue — RPE Trend</h2>
                    <p className="text-xs text-[#8A919C] mb-4">
                      Avg RPE per session for {selectedExerciseId === "all" ? "Overall Workouts" : activeExercise.title}
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={rpeSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rpeFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7FA6FF" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#7FA6FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#1E222A" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "#8A919C", fontSize: 10 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
                        <YAxis domain={[4, 10]} tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <ReferenceLine y={9} stroke="#EF7B57" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <Tooltip content={<CustomTooltip suffix=" RPE" />} />
                        <Area type="monotone" dataKey="rpe" name="RPE" stroke="#7FA6FF" strokeWidth={2} fill="url(#rpeFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 1RM Trend */}
                <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5 relative z-0 space-y-3">
                  {selectedExercisePlateauStatus.isPlateaued && (
                    <div className="rounded-lg border border-[#F4B740]/30 bg-[#F4B740]/5 p-3 flex items-start gap-2 text-xs text-[#F4B740] transition-all">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Training Plateau Detected</span>
                        No meaningful change in estimated 1RM has been achieved in the last {selectedExercisePlateauStatus.sessionsFlat} sessions (since {fmtDate(selectedExercisePlateauStatus.sinceDate)}). Consider altering your rep ranges or exercise variation to break the adaptation.
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">Progressive Overload — Est. 1RM</h2>
                      <p className="text-xs text-[#8A919C]">
                        Gold dot = peak PR record ({selectedExerciseId === "all" ? "Overall" : activeExercise.title})
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={oneRmSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="#1E222A" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
                      <YAxis tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
                      <Tooltip content={<CustomTooltip suffix=" kg" />} />
                      <Line
                        type="monotone"
                        dataKey="oneRm"
                        name="Est. 1RM"
                        stroke="#F4B740"
                        strokeWidth={2}
                        dot={(props) => {
                          const { cx, cy, payload, index } = props;
                          return (
                            <circle
                              key={`dot-${index}`}
                              cx={cx}
                              cy={cy}
                              r={payload.isPR ? 5 : 3}
                              fill={payload.isPR ? "#F4B740" : "#0C0E12"}
                              stroke="#F4B740"
                              strokeWidth={payload.isPR ? 0 : 2}
                            />
                          );
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* ACWR Chart */}
                <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5 relative z-0">
                  <h2 className="text-sm font-semibold mb-1">Training Load — Acute:Chronic Workload Ratio</h2>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-xs text-[#8A919C]">Volume vs trailing 4-week moving average</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#8A919C]">
                        <span className="w-2.5 h-2.5 rounded bg-[#7FA6FF]/20 border border-[#7FA6FF]/40 inline-block" />
                        <span>Under-trained (&lt;0.8)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#8A919C]">
                        <span className="w-2.5 h-2.5 rounded bg-[#4FD1C5]/20 border border-[#4FD1C5]/40 inline-block" />
                        <span>Sweet Spot (0.8 - 1.3)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#8A919C]">
                        <span className="w-2.5 h-2.5 rounded bg-[#F4B740]/25 border border-[#F4B740]/45 inline-block" />
                        <span>Caution (1.3 - 1.5)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#8A919C]">
                        <span className="w-2.5 h-2.5 rounded bg-[#EF7B57]/25 border border-[#EF7B57]/45 inline-block" />
                        <span>Danger Zone (&gt;1.5)</span>
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={visibleWeeklyStats.filter(w => w.date).map((w) => ({ ...w, label: fmtDate(w.date) }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="#1E222A" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#8A919C", fontSize: 10 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
                      <YAxis domain={[0, 1.8]} tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <ReferenceArea y1={0} y2={0.8} fill="#7FA6FF" fillOpacity={0.08} />
                      <ReferenceArea y1={0.8} y2={1.3} fill="#4FD1C5" fillOpacity={0.08} />
                      <ReferenceArea y1={1.3} y2={1.5} fill="#F4B740" fillOpacity={0.1} />
                      <ReferenceArea y1={1.5} y2={1.8} fill="#EF7B57" fillOpacity={0.1} />
                      <Tooltip content={<CustomTooltip suffix="" />} />
                      <Line type="monotone" dataKey="acwr" name="ACWR" stroke="#E7E9EC" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Live Log Records Table (Sortable headers added) */}
                <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5 relative z-0">
                  <h2 className="text-sm font-semibold mb-3">Live Log Records</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[#8A919C] border-b border-[#232830]">
                          <th className="py-2 pr-3 font-medium cursor-pointer select-none hover:text-[#E7E9EC] transition-colors" onClick={() => handleSort("completed_at")}>
                            Date {sortColumn === "completed_at" && (sortDirection === "asc" ? "▲" : "▼")}
                          </th>
                          <th className="py-2 pr-3 font-medium cursor-pointer select-none hover:text-[#E7E9EC] transition-colors" onClick={() => handleSort("title")}>
                            Exercise {sortColumn === "title" && (sortDirection === "asc" ? "▲" : "▼")}
                          </th>
                          <th className="py-2 pr-3 font-medium cursor-pointer select-none hover:text-[#E7E9EC] transition-colors" onClick={() => handleSort("muscle_group")}>
                            Muscle {sortColumn === "muscle_group" && (sortDirection === "asc" ? "▲" : "▼")}
                          </th>
                          <th className="py-2 pr-3 font-medium text-right cursor-pointer select-none hover:text-[#E7E9EC] transition-colors" onClick={() => handleSort("weight_kg")}>
                            Weight {sortColumn === "weight_kg" && (sortDirection === "asc" ? "▲" : "▼")}
                          </th>
                          <th className="py-2 pr-3 font-medium text-right cursor-pointer select-none hover:text-[#E7E9EC] transition-colors" onClick={() => handleSort("reps")}>
                            Reps {sortColumn === "reps" && (sortDirection === "asc" ? "▲" : "▼")}
                          </th>
                          <th className="py-2 pr-3 font-medium text-right cursor-pointer select-none hover:text-[#E7E9EC] transition-colors" onClick={() => handleSort("rpe")}>
                            RPE {sortColumn === "rpe" && (sortDirection === "asc" ? "▲" : "▼")}
                          </th>
                          <th className="py-2 pr-3 font-medium text-right cursor-pointer select-none hover:text-[#E7E9EC] transition-colors" onClick={() => handleSort("est1rm")}>
                            Est. 1RM {sortColumn === "est1rm" && (sortDirection === "asc" ? "▲" : "▼")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSets.map((r, i) => (
                          <tr key={r.id || i} className={i % 2 ? "bg-[#0F1216]" : ""}>
                            <td className="py-2 pr-3 text-[#8A919C] whitespace-nowrap">
                              {fmtDate(r.completed_at)}
                            </td>
                            <td className="py-2 pr-3 font-medium">{r.title || r.work_id}</td>
                            <td className="py-2 pr-3">
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px]"
                                style={{
                                  background: `${MUSCLE_COLORS[r.muscle_group] || "#8A919C"}22`,
                                  color: MUSCLE_COLORS[r.muscle_group] || "#8A919C"
                                }}
                              >
                                {r.muscle_group || "General"}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">{r.weight_kg ?? 0} kg</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{r.reps ?? 0}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{r.rpe ?? "-"}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{estOneRM(r.weight_kg, r.reps)} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#232830] pt-4 mt-4 text-xs text-[#8A919C] transition-all">
                    <div className="flex items-center gap-1.5">
                      <span>Rows per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-[#15181D] border border-[#232830] rounded px-1.5 py-1 text-xs text-[#E7E9EC] focus:ring-0 focus:outline-none cursor-pointer"
                      >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span>
                        Showing {sortedTableLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{" "}
                        {Math.min(currentPage * pageSize, sortedTableLogs.length)} of {sortedTableLogs.length}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="p-1 rounded bg-[#1B1F26] border border-[#232830] hover:bg-[#232830] hover:text-[#E7E9EC] disabled:opacity-40 disabled:hover:bg-[#1B1F26] disabled:hover:text-[#8A919C] transition-colors"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(Math.ceil(sortedTableLogs.length / pageSize), prev + 1))}
                          disabled={currentPage >= Math.ceil(sortedTableLogs.length / pageSize)}
                          className="p-1 rounded bg-[#1B1F26] border border-[#232830] hover:bg-[#232830] hover:text-[#E7E9EC] disabled:opacity-40 disabled:hover:bg-[#1B1F26] disabled:hover:text-[#8A919C] transition-colors"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* AI Decision Engine View */}
            {activeTab === "decision" && (
              <div className="space-y-6">
                {/* Decision Header/Summary */}
                <div className="rounded-xl border border-[#232830] bg-gradient-to-r from-[#15181D] to-[#1C1F26] p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F4B740]/10 border border-[#F4B740]/30 flex items-center justify-center">
                      <Brain size={20} color="#F4B740" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-[#E7E9EC]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                        AI DECISION ENGINE
                      </h2>
                      <p className="text-xs text-[#8A919C]">
                        Personalized training advice powered by your Supabase workout logs
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Card 1: Recovery Status */}
                  <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider text-[#8A919C]">Recovery Status</span>
                        <Timer size={16} className="text-[#F4B740]" />
                      </div>
                      
                      {recoveryStatus ? (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-baseline gap-2">
                            {recoveryStatus.isRecovered ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-2xl font-semibold text-[#4FD1C5] flex items-center gap-2" style={{ fontFamily: "'Oswald', sans-serif" }}>
                                  <CheckCircle2 size={24} /> FULLY RECOVERED
                                </span>
                                <span className="text-xs text-[#8A919C]">Ready for maximum physical stimulus.</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-3xl font-bold font-mono tracking-tight text-[#E7E9EC]">
                                  {recoveryStatus.countdownStr}
                                </span>
                                <span className="text-xs text-[#8A919C]">Remaining until fully recovered.</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Recovery Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-[#8A919C] font-semibold">
                              <span>Total Recovery Progress</span>
                              <span className="text-[#E7E9EC]">{recoveryStatus.pct}%</span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-[#0C0E12] overflow-hidden border border-[#232830]">
                              <div 
                                className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-[#F4B740] to-[#4FD1C5]" 
                                style={{ width: `${recoveryStatus.pct}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="text-xs space-y-1.5 border-t border-[#232830]/50 pt-3 text-[#8A919C]">
                            <div className="flex justify-between">
                              <span>Latest Workout:</span>
                              <span className="text-[#E7E9EC] font-mono">
                                {recoveryDetails.completedTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {recoveryDetails.completedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Intensity (RPE):</span>
                              <span className="text-[#E7E9EC] font-semibold">{recoveryDetails.rpe} / 10</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Recommended Rest:</span>
                              <span className="text-[#E7E9EC] font-semibold">{recoveryDetails.restHours} Hours</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Recovery Complete:</span>
                              <span className="text-[#E7E9EC] font-mono">
                                {recoveryDetails.targetTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {recoveryDetails.targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8A919C] pt-2">No recovery data available. Add a workout log to start tracking.</p>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Next Workout & Muscle Prioritization */}
                  <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider text-[#8A919C]">Training Recommendation</span>
                        <Dumbbell size={16} className="text-[#F4B740]" />
                      </div>
                      
                      {musclePriorities.recommended ? (
                        <div className="space-y-3">
                          <div className="bg-[#0C0E12] rounded-lg border border-[#232830] p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[#8A919C] block">Target Muscle Group</span>
                                <span className="text-xl font-semibold text-[#F4B740]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                                  {musclePriorities.recommended.muscle.toUpperCase()}
                                </span>
                              </div>
                              <div className="px-3 py-1 rounded text-xs font-semibold bg-[#4FD1C5]/10 text-[#4FD1C5] border border-[#4FD1C5]/30">
                                {musclePriorities.recommended.isRecovered ? "Ready" : "Recovering"}
                              </div>
                            </div>
                            
                            <div className="border-t border-[#232830]/50 pt-2.5 space-y-1">
                              <span className="text-[10px] uppercase tracking-wider text-[#8A919C] block">Recommended Workout Split</span>
                              {aiCoachingLoading ? (
                                <div className="h-4 bg-[#8A919C]/20 rounded w-2/3 animate-pulse" />
                              ) : (
                                <span className="text-xs font-medium text-[#E7E9EC] block">
                                  {aiCoaching?.recommendedSplit || `${musclePriorities.recommended.muscle.charAt(0).toUpperCase() + musclePriorities.recommended.muscle.slice(1)} Focus Session`}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Muscle status breakdowns */}
                          <div className="space-y-2.5">
                            <span className="text-[11px] text-[#8A919C] uppercase tracking-wider block font-semibold border-b border-[#232830]/50 pb-1.5">
                              Muscle Group Status
                            </span>
                            
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                              {/* Fully Recovered Muscles */}
                              {musclePriorities.fullyRecovered.map(m => (
                                <div key={m.muscle} className="flex justify-between items-center text-xs">
                                  <span className="text-[#E7E9EC] capitalize font-medium">{m.muscle}</span>
                                  <span className="text-[#4FD1C5] font-semibold text-[11px] flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Rested {m.daysSince} days
                                  </span>
                                </div>
                              ))}
                              
                              {/* Recovering Muscles */}
                              {musclePriorities.recovering.map(m => (
                                <div key={m.muscle} className="flex justify-between items-center text-xs">
                                  <span className="text-[#E7E9EC]/70 capitalize">{m.muscle}</span>
                                  <span className="text-[#F4B740] font-semibold text-[11px] flex items-center gap-1">
                                    <AlertTriangle size={12} /> Rest {Math.round(m.hoursRemaining)}h left
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8A919C]">No muscle group logs found to analyze priorities.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card 3: AI Projections & Overload Targets */}
                {fatigueInfo ? (
                  <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-[#8A919C]">AI Fatigue &amp; Overload Projection</span>
                      <Brain size={16} className="text-[#F4B740]" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Fatigue Predictor */}
                      <div className="bg-[#0C0E12] rounded-lg border border-[#232830] p-4 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] text-[#8A919C] font-semibold">Predicted Fatigue Level</span>
                            <span 
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" 
                              style={{ 
                                background: `${fatigueInfo.fatigueColor}22`, 
                                color: fatigueInfo.fatigueColor,
                                border: `1px solid ${fatigueInfo.fatigueColor}40`
                              }}
                            >
                              {fatigueInfo.fatigueLevel}
                            </span>
                          </div>
                          <p className="text-xs text-[#8A919C] leading-relaxed">
                            {fatigueInfo.fatigueDetails}
                          </p>
                        </div>
                        {recommendedExerciseInjuryRisk && recommendedExerciseInjuryRisk.level !== "none" && (
                          <div className="rounded border border-[#EF7B57]/30 bg-[#EF7B57]/5 p-2 flex items-start gap-1.5 text-[11px] text-[#EF7B57] transition-all">
                            <AlertOctagon size={13} className="shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block uppercase tracking-wider text-[9px] text-[#EF7B57]/90">
                                {recommendedExerciseInjuryRisk.level === "elevated" ? "Elevated Injury Risk" : "Injury Watch"}
                              </span>
                              {recommendedExerciseInjuryRisk.reason}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Progressive Overload Projections */}
                      <div className="bg-[#0C0E12] rounded-lg border border-[#232830] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#8A919C] font-semibold">Next Target Exercise</span>
                          <span className="text-[#E7E9EC] text-[11px] font-medium font-mono">{fatigueInfo.exerciseName}</span>
                        </div>
                        <div className="text-xs space-y-1 text-[#8A919C]">
                          <div className="flex justify-between">
                            <span>Last Logged Session:</span>
                            <span className="text-[#E7E9EC] font-semibold font-mono">{fatigueInfo.lastWeight} kg x {fatigueInfo.lastReps} reps</span>
                          </div>
                          <div className="pt-2 border-t border-[#232830] mt-2">
                            {aiCoachingLoading ? (
                              <div className="flex items-center gap-1.5 text-[#F4B740] animate-pulse">
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-[#F4B740] animate-spin inline-block shrink-0" />
                                <span>Generating AI targets...</span>
                              </div>
                            ) : (
                              <span className="text-[#F4B740] font-semibold flex items-center gap-1">
                                <Rocket size={13} /> {aiCoaching?.targetRecommendation || `Repeat last session: ${fatigueInfo.lastWeight} kg x ${fatigueInfo.lastReps} reps`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#F4B740]/5 rounded-lg border border-[#F4B740]/20 p-4">
                      <div className="flex gap-2">
                        <Rocket size={16} className="text-[#F4B740] shrink-0 mt-0.5" />
                        <div className="space-y-1 w-full">
                          <span className="text-xs font-semibold text-[#F4B740] block">AI Growth Recommendation</span>
                          {aiCoachingLoading ? (
                            <div className="space-y-1.5 py-1.5 animate-pulse w-full">
                              <div className="h-3 bg-[#8A919C]/20 rounded w-full" />
                              <div className="h-3 bg-[#8A919C]/20 rounded w-11/12" />
                              <div className="h-3 bg-[#8A919C]/20 rounded w-3/4" />
                            </div>
                          ) : (
                            <p className="text-xs text-[#8A919C] leading-relaxed">
                              {aiCoaching?.recommendationText || fatigueInfo.fatigueDetails}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 text-center text-xs text-[#8A919C]">
                    No projection data could be calculated. Complete more training logs to activate AI fatigue forecasting.
                  </div>
                )}
              </div>
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
