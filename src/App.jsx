import { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from "recharts";
import {
  Dumbbell, TrendingUp, TrendingDown, Flame, CalendarCheck,
  ChevronDown, Trophy, Database, X, Activity, Rocket, Gauge, Timer, RefreshCw
} from "lucide-react";

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function fetchWorkoutLogs() {
  const { data, error } = await supabase
    .from('workout_log')
    .select('*')
    .order('completed_at', { ascending: true });

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
  Chest: "#F4B740",
  Legs: "#4FD1C5",
  Back: "#EF7B57",
  Shoulders: "#7FA6FF",
  Arms: "#A78BFA",
  Core: "#F472B6",
};

const PERIODS = [
  { label: "4W", weeks: 4 },
  { label: "8W", weeks: 8 },
  { label: "All", weeks: WEEKS },
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

function buildOneRmSeries(rows) {
  const bySession = {};
  rows.forEach((r) => {
    const key = r.set_id ? r.set_id.split("-s")[0] : `${r.work_id || r.title}-${r.completed_at}`;
    const calculated1RM = r.best_1rm || estOneRM(r.weight_kg, r.reps);
    if (!bySession[key] || calculated1RM > (bySession[key]._calc1RM || 0)) {
      bySession[key] = { ...r, _calc1RM: calculated1RM };
    }
  });
  const sorted = Object.values(bySession).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
  let runningMax = 0;
  return sorted.map((r) => {
    const isPR = r._calc1RM > runningMax;
    if (isPR) runningMax = r._calc1RM;
    return { rawDate: r.completed_at, date: fmtDate(r.completed_at), oneRm: r._calc1RM, isPR, weekIndex: r._weekIndex };
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
  const [periodIdx, setPeriodIdx] = useState(2); // Default to 'All'
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [exOpen, setExOpen] = useState(false);

  const [rawLogs, setRawLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await fetchWorkoutLogs();
      console.log("Raw Supabase Data Loaded:", data);
      setRawLogs(data);
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
      const id = r.work_id || r.title;
      if (id && !map.has(id)) {
        map.set(id, { work_id: id, title: r.title || id, muscle_group: r.muscle_group || "General" });
      }
    });
    return Array.from(map.values());
  }, [rawLogs]);

  // Set default selected exercise once data loads
  useEffect(() => {
    if (exercisesList.length && !selectedExerciseId) {
      setSelectedExerciseId(exercisesList[0].work_id);
    }
  }, [exercisesList, selectedExerciseId]);

  // 2. Dynamic Anchor Date derived from the latest log date in Supabase
  const anchorDate = useMemo(() => {
    if (!rawLogs.length) return new Date();
    const latestIso = rawLogs.reduce((max, r) => (r.completed_at > max ? r.completed_at : max), rawLogs[0].completed_at);
    return new Date(latestIso);
  }, [rawLogs]);

  // 3. Attach derived week indices relative to the latest log
  const logs = useMemo(() => {
    return rawLogs.map((row) => {
      const rowDate = new Date(row.completed_at);
      const diffDays = Math.floor((anchorDate - rowDate) / (1000 * 60 * 60 * 24));
      const weeksAgo = Math.floor(diffDays / 7);
      const weekIdx = WEEKS - 1 - weeksAgo;
      return {
        ...row,
        _weekIndex: Math.max(0, Math.min(WEEKS - 1, weekIdx)),
      };
    });
  }, [rawLogs, anchorDate]);

  const period = PERIODS[periodIdx];
  const cutoff = useMemo(() => {
    const c = new Date(anchorDate);
    c.setDate(c.getDate() - period.weeks * 7);
    return c;
  }, [anchorDate, period]);

  const prevCutoff = useMemo(() => {
    const c = new Date(cutoff);
    c.setDate(c.getDate() - period.weeks * 7);
    return c;
  }, [cutoff, period]);

  const inPeriod = useMemo(() => logs.filter((r) => new Date(r.completed_at) >= cutoff), [logs, cutoff]);
  const prevPeriod = useMemo(
    () => logs.filter((r) => new Date(r.completed_at) >= prevCutoff && new Date(r.completed_at) < cutoff),
    [logs, cutoff, prevCutoff]
  );

  const activeExercise = exercisesList.find((e) => e.work_id === selectedExerciseId) || exercisesList[0] || { title: "N/A", muscle_group: "N/A" };

  // ---- Core KPI calculations ----
  const totalVolume = inPeriod.reduce((s, r) => s + (r.weight_kg || 0) * (r.reps || 0), 0);
  const prevVolume = prevPeriod.reduce((s, r) => s + (r.weight_kg || 0) * (r.reps || 0), 0);
  const volumeDelta = prevVolume ? ((totalVolume - prevVolume) / prevVolume) * 100 : 0;

  const avgRpe = inPeriod.length ? inPeriod.reduce((s, r) => s + (r.rpe || 0), 0) / inPeriod.length : 0;
  const prevAvgRpe = prevPeriod.length ? prevPeriod.reduce((s, r) => s + (r.rpe || 0), 0) / prevPeriod.length : 0;
  const rpeDelta = prevAvgRpe ? ((avgRpe - prevAvgRpe) / prevAvgRpe) * 100 : 0;

  const sessionsCount = new Set(inPeriod.map((r) => (r.set_id ? r.set_id.split("-s")[0] : r.completed_at?.slice(0, 10)))).size;
  const prevSessionsCount = new Set(prevPeriod.map((r) => (r.set_id ? r.set_id.split("-s")[0] : r.completed_at?.slice(0, 10)))).size;
  const sessionsDelta = prevSessionsCount ? ((sessionsCount - prevSessionsCount) / prevSessionsCount) * 100 : 0;

  const exRows = useMemo(() => logs.filter((r) => (r.work_id || r.title) === selectedExerciseId), [logs, selectedExerciseId]);
  const currentBest1RM = exRows.length ? Math.max(...exRows.map((r) => r.best_1rm || estOneRM(r.weight_kg, r.reps))) : 0;
  const priorBest1RM = exRows
    .filter((r) => new Date(r.completed_at) < cutoff)
    .reduce((max, r) => Math.max(max, r.best_1rm || estOneRM(r.weight_kg, r.reps)), 0);
  const oneRmDelta = priorBest1RM ? ((currentBest1RM - priorBest1RM) / priorBest1RM) * 100 : null;

  // ---- Weekly training-load stats (ACWR) ----
  const weeklyStats = useMemo(() => {
    const volumeByWeek = Array(WEEKS).fill(0);
    const dateByWeek = Array(WEEKS).fill(null);
    logs.forEach((r) => {
      const idx = r._weekIndex;
      volumeByWeek[idx] += (r.weight_kg || 0) * (r.reps || 0);
      if (!dateByWeek[idx] || new Date(r.completed_at) < new Date(dateByWeek[idx])) {
        dateByWeek[idx] = r.completed_at;
      }
    });
    return volumeByWeek.map((vol, w) => {
      const windowStart = Math.max(0, w - 3);
      const windowVols = volumeByWeek.slice(windowStart, w + 1);
      const chronic = windowVols.reduce((a, b) => a + b, 0) / windowVols.length;
      const acwr = chronic ? Math.round((vol / chronic) * 100) / 100 : 0;
      const isDeload = chronic > 0 && vol < chronic * 0.8;
      return { weekIndex: w, volume: Math.round(vol), chronic: Math.round(chronic), acwr, isDeload, date: dateByWeek[w] };
    });
  }, [logs]);

  const visibleWeeklyStats = useMemo(() => weeklyStats.slice(WEEKS - period.weeks), [weeklyStats, period]);
  const currentAcwr = weeklyStats[WEEKS - 1]?.acwr || 0;
  const acwrInfo = acwrZone(currentAcwr);

  // ---- 1RM series for selected exercise ----
  const fullSeries = useMemo(() => buildOneRmSeries(exRows), [exRows]);
  const oneRmSeries = useMemo(
    () =>
      fullSeries
        .filter((p) => new Date(p.rawDate) >= cutoff)
        .map((p) => ({ ...p, isDeload: weeklyStats[p.weekIndex]?.isDeload })),
    [fullSeries, cutoff, weeklyStats]
  );
  const progressRate = linregSlope(oneRmSeries.map((p, i) => ({ x: i, y: p.oneRm })));
  const progressRatePct = oneRmSeries.length && oneRmSeries[0].oneRm ? (progressRate / oneRmSeries[0].oneRm) * 100 : 0;

  // ---- Volume by muscle group ----
  const volumeByMuscle = useMemo(() => {
    const weeks = {};
    inPeriod.forEach((r) => {
      const wk = fmtDate(r.completed_at);
      weeks[wk] = weeks[wk] || { week: wk };
      const mg = r.muscle_group || "Other";
      weeks[wk][mg] = (weeks[wk][mg] || 0) + (r.weight_kg || 0) * (r.reps || 0);
    });
    return Object.values(weeks);
  }, [inPeriod]);
  const muscleGroups = [...new Set(inPeriod.map((r) => r.muscle_group || "Other"))];

  // ---- RPE trend ----
  const rpeSeries = useMemo(() => {
    const bySession = {};
    exRows
      .filter((r) => new Date(r.completed_at) >= cutoff)
      .forEach((r) => {
        const key = r.set_id ? r.set_id.split("-s")[0] : r.completed_at;
        bySession[key] = bySession[key] || { sum: 0, n: 0, date: r.completed_at };
        bySession[key].sum += r.rpe || 0;
        bySession[key].n += 1;
      });
    return Object.values(bySession)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((s) => ({ date: fmtDate(s.date), rpe: Math.round((s.sum / s.n) * 10) / 10 }));
  }, [exRows, cutoff]);

  // ---- Recent sets table ----
  const recentSets = [...inPeriod].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 8);

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

      <div className="max-w-5xl mx-auto p-5 md:p-8 space-y-6">
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

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 text-xs text-[#8A919C] border border-[#232830] hover:border-[#3A414C] rounded-lg px-3 py-2 transition-colors"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-1.5 text-xs text-[#8A919C] border border-[#232830] hover:border-[#3A414C] rounded-lg px-3 py-2 transition-colors"
            >
              <Database size={13} /> Status
            </button>
            <div className="flex rounded-lg border border-[#232830] overflow-hidden">
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
            {/* KPI Row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={Flame} label="Total Volume" value={Math.round(totalVolume).toLocaleString()} unit="kg" delta={volumeDelta} accent="#F4B740" />
              <KpiCard
                icon={Trophy}
                label={`Best 1RM · ${activeExercise.title}`}
                value={currentBest1RM}
                unit="kg"
                delta={oneRmDelta}
                accent="#EF7B57"
              />
              <KpiCard icon={Activity} label="Avg RPE" value={avgRpe.toFixed(1)} unit="/ 10" delta={rpeDelta} accent="#7FA6FF" />
              <KpiCard icon={CalendarCheck} label="Sessions Logged" value={sessionsCount} unit="" delta={sessionsDelta} accent="#4FD1C5" />
            </div>

            {/* KPI Row 2 — training-science metrics */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8A919C] mb-2">Load &amp; Recovery</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MetricCard
                  icon={Rocket}
                  label={`Progress Rate · ${activeExercise.title}`}
                  value={`${progressRate >= 0 ? "+" : ""}${progressRate.toFixed(1)}`}
                  unit="kg/session"
                  accent={progressRate >= 0 ? "#4FD1C5" : "#EF7B57"}
                  subtitle={`${progressRatePct >= 0 ? "+" : ""}${progressRatePct.toFixed(1)}% trajectory`}
                  subtitleColor={progressRate >= 0 ? "#4FD1C5" : "#EF7B57"}
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

            {/* 1RM Trend */}
            <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-semibold">Progressive Overload — Est. 1RM</h2>
                  <p className="text-xs text-[#8A919C]">Gold dot = peak PR record</p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setExOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs bg-[#0C0E12] border border-[#232830] rounded-lg px-3 py-1.5"
                  >
                    {activeExercise.title} <ChevronDown size={13} />
                  </button>
                  {exOpen && (
                    <div className="absolute right-0 mt-1 w-56 rounded-lg border border-[#232830] bg-[#1B1F26] shadow-xl z-10 overflow-hidden max-h-60 overflow-y-auto">
                      {exercisesList.map((e) => (
                        <button
                          key={e.work_id}
                          onClick={() => {
                            setSelectedExerciseId(e.work_id);
                            setExOpen(false);
                          }}
                          className="block w-full text-left px-3 py-2 text-xs hover:bg-[#232830]"
                        >
                          {e.title}
                        </button>
                      ))}
                    </div>
                  )}
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
            <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
              <h2 className="text-sm font-semibold mb-1">Training Load — Acute:Chronic Workload Ratio</h2>
              <p className="text-xs text-[#8A919C] mb-4">Volume vs trailing 4-week moving average</p>
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

            <div className="grid md:grid-cols-2 gap-6">
              {/* Volume by muscle group */}
              <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
                <h2 className="text-sm font-semibold mb-1">Volume by Muscle Group</h2>
                <p className="text-xs text-[#8A919C] mb-4">Weekly kg lifted across categories</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={volumeByMuscle} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#1E222A" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: "#8A919C", fontSize: 10 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
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
                <p className="text-xs text-[#8A919C] mb-4">Avg RPE per session for {activeExercise.title}</p>
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

            {/* Recent sets table */}
            <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
              <h2 className="text-sm font-semibold mb-3">Live Log Records</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[#8A919C] border-b border-[#232830]">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Exercise</th>
                      <th className="py-2 pr-3 font-medium">Muscle</th>
                      <th className="py-2 pr-3 font-medium text-right">Weight</th>
                      <th className="py-2 pr-3 font-medium text-right">Reps</th>
                      <th className="py-2 pr-3 font-medium text-right">RPE</th>
                      <th className="py-2 pr-3 font-medium text-right">Est. 1RM</th>
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
            </div>
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
