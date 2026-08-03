import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from "recharts";
import {
  Dumbbell, TrendingUp, TrendingDown, Flame, CalendarCheck,
  ChevronDown, Trophy, Database, X, Activity, Rocket, Gauge, Timer,
} from "lucide-react";

/* =========================================================================
   DATA LAYER
   -------------------------------------------------------------------------
   This mirrors the shape of a real Supabase call against `workout_log`.
   Today it returns generated mock rows so the dashboard works standalone.
   To go live, delete MOCK ROWS + generateMockRows(), and replace
   fetchWorkoutLogs() with the commented block below (swap-ready).

   Note: each mock row also carries `_weekIndex`, a client-side grouping
   helper used for the load metrics (ACWR, deload detection) below. It is
   NOT a column in your table — when using real data, derive the same
   thing from `completed_at` (e.g. ISO week number) on the client.
   ========================================================================= */

// --- Real Supabase config (inactive — shown for reference / easy swap) ---
// import { createClient } from '@supabase/supabase-js';
// const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_ANON_KEY
// );
//
// export async function fetchWorkoutLogs() {
//   const { data, error } = await supabase
//     .from('workout_log')
//     .select('id, work_id, title, set_id, weight_kg, rpe, reps, index, best_weight, best_volume, best_1rm, muscle_group, completed_at')
//     .order('completed_at', { ascending: true });
//   if (error) throw error;
//   return data;
// }

const EXERCISES = [
  { work_id: "ex1", title: "Barbell Bench Press", muscle_group: "Chest", base: 60, gain: 1.1, dayOffset: 0 },
  { work_id: "ex2", title: "Back Squat", muscle_group: "Legs", base: 80, gain: 1.6, dayOffset: 2 },
  { work_id: "ex3", title: "Deadlift", muscle_group: "Back", base: 100, gain: 1.8, dayOffset: 1 },
  { work_id: "ex4", title: "Overhead Press", muscle_group: "Shoulders", base: 40, gain: 0.6, dayOffset: 4 },
  { work_id: "ex5", title: "Barbell Row", muscle_group: "Back", base: 55, gain: 0.9, dayOffset: 3 },
  { work_id: "ex6", title: "Weighted Pull-up", muscle_group: "Back", base: 15, gain: 0.7, dayOffset: 5 },
];

const WEEKS = 10;
const ANCHOR_DATE = new Date("2026-08-03T00:00:00");

function round25(n) {
  return Math.round(n / 2.5) * 2.5;
}
function estOneRM(weight, reps) {
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

function generateMockRows() {
  const rows = [];
  let idCounter = 1;
  EXERCISES.forEach((ex) => {
    for (let w = 0; w < WEEKS; w++) {
      const isDeload = w === 4 || w === 8;
      const weekStart = new Date(ANCHOR_DATE);
      weekStart.setDate(weekStart.getDate() - (WEEKS - 1 - w) * 7);
      const date = new Date(weekStart);
      date.setDate(date.getDate() + ex.dayOffset);

      const wave = Math.sin(w / 1.7) * (ex.base * 0.015);
      const progress = ex.base + ex.gain * w + wave;
      const topWeight = round25(isDeload ? progress * 0.85 : progress);

      const setPlan = isDeload
        ? [{ reps: 6, drop: 0.1 }, { reps: 6, drop: 0.1 }, { reps: 6, drop: 0.1 }]
        : [{ reps: 5, drop: 0 }, { reps: 5, drop: 0.03 }, { reps: 4, drop: 0.06 }, { reps: 3, drop: 0.1 }];

      const sessionSets = setPlan.map((s, i) => {
        const weight_kg = round25(topWeight * (1 - s.drop));
        const rpe = Math.min(10, Math.round((isDeload ? 6 + i * 0.3 : 7.5 + i * 0.5) * 2) / 2);
        return { index: i + 1, weight_kg, reps: s.reps, rpe };
      });

      const best_weight = Math.max(...sessionSets.map((s) => s.weight_kg));
      const best_volume = sessionSets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
      const best_1rm = Math.max(...sessionSets.map((s) => estOneRM(s.weight_kg, s.reps)));

      sessionSets.forEach((s) => {
        rows.push({
          id: idCounter++,
          work_id: ex.work_id,
          title: ex.title,
          set_id: `${ex.work_id}-w${w}-s${s.index}`,
          weight_kg: s.weight_kg,
          rpe: s.rpe,
          reps: s.reps,
          index: s.index,
          best_weight,
          best_volume,
          best_1rm,
          muscle_group: ex.muscle_group,
          completed_at: date.toISOString(),
          _weekIndex: w,
        });
      });
    }
  });
  return rows.sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
}

export async function fetchWorkoutLogs() {
  // Swap this function's body for the real Supabase block above when ready.
  return generateMockRows();
}

const MOCK_ROWS = generateMockRows();

const MUSCLE_COLORS = {
  Chest: "#F4B740",
  Legs: "#4FD1C5",
  Back: "#EF7B57",
  Shoulders: "#7FA6FF",
};

const PERIODS = [
  { label: "4W", weeks: 4 },
  { label: "8W", weeks: 8 },
  { label: "All", weeks: WEEKS },
];

function fmtDate(iso) {
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
    const key = r.set_id.split("-s")[0];
    if (!bySession[key] || r.best_1rm > bySession[key].best_1rm) bySession[key] = r;
  });
  const sorted = Object.values(bySession).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
  let runningMax = 0;
  return sorted.map((r) => {
    const isPR = r.best_1rm > runningMax;
    if (isPR) runningMax = r.best_1rm;
    return { rawDate: r.completed_at, date: fmtDate(r.completed_at), oneRm: r.best_1rm, isPR, weekIndex: r._weekIndex };
  });
}

/* ---------------------------- UI bits ---------------------------- */

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
      {delta !== null && delta !== undefined && (
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
  const [periodIdx, setPeriodIdx] = useState(1);
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].work_id);
  const [showSetup, setShowSetup] = useState(false);
  const [exOpen, setExOpen] = useState(false);

  const period = PERIODS[periodIdx];
  const cutoff = new Date(ANCHOR_DATE);
  cutoff.setDate(cutoff.getDate() - period.weeks * 7);
  const prevCutoff = new Date(cutoff);
  prevCutoff.setDate(prevCutoff.getDate() - period.weeks * 7);

  const inPeriod = useMemo(() => MOCK_ROWS.filter((r) => new Date(r.completed_at) >= cutoff), [cutoff]);
  const prevPeriod = useMemo(
    () => MOCK_ROWS.filter((r) => new Date(r.completed_at) >= prevCutoff && new Date(r.completed_at) < cutoff),
    [cutoff, prevCutoff]
  );

  const exercise = EXERCISES.find((e) => e.work_id === exerciseId);

  // ---- Core KPI calculations ----
  const totalVolume = inPeriod.reduce((s, r) => s + r.weight_kg * r.reps, 0);
  const prevVolume = prevPeriod.reduce((s, r) => s + r.weight_kg * r.reps, 0);
  const volumeDelta = prevVolume ? ((totalVolume - prevVolume) / prevVolume) * 100 : 0;

  const avgRpe = inPeriod.length ? inPeriod.reduce((s, r) => s + r.rpe, 0) / inPeriod.length : 0;
  const prevAvgRpe = prevPeriod.length ? prevPeriod.reduce((s, r) => s + r.rpe, 0) / prevPeriod.length : 0;
  const rpeDelta = prevAvgRpe ? ((avgRpe - prevAvgRpe) / prevAvgRpe) * 100 : 0;

  const sessionsCount = new Set(inPeriod.map((r) => r.set_id.split("-s")[0])).size;
  const prevSessionsCount = new Set(prevPeriod.map((r) => r.set_id.split("-s")[0])).size;
  const sessionsDelta = prevSessionsCount ? ((sessionsCount - prevSessionsCount) / prevSessionsCount) * 100 : 0;

  const exRows = MOCK_ROWS.filter((r) => r.work_id === exerciseId);
  const currentBest1RM = exRows.length ? Math.max(...exRows.map((r) => r.best_1rm)) : 0;
  const priorBest1RM = exRows
    .filter((r) => new Date(r.completed_at) < cutoff)
    .reduce((max, r) => Math.max(max, r.best_1rm), 0);
  const oneRmDelta = priorBest1RM ? ((currentBest1RM - priorBest1RM) / priorBest1RM) * 100 : null;

  // ---- Weekly training-load stats (full history, used for ACWR + deload) ----
  const weeklyStats = useMemo(() => {
    const volumeByWeek = Array(WEEKS).fill(0);
    const dateByWeek = Array(WEEKS).fill(null);
    MOCK_ROWS.forEach((r) => {
      volumeByWeek[r._weekIndex] += r.weight_kg * r.reps;
      if (!dateByWeek[r._weekIndex] || new Date(r.completed_at) < new Date(dateByWeek[r._weekIndex])) {
        dateByWeek[r._weekIndex] = r.completed_at;
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
  }, []);

  const visibleWeeklyStats = useMemo(() => weeklyStats.slice(WEEKS - period.weeks), [weeklyStats, period]);
  const currentAcwr = weeklyStats[WEEKS - 1].acwr;
  const acwrInfo = acwrZone(currentAcwr);
  const deloadWeeksVisible = visibleWeeklyStats.filter((w) => w.isDeload);
  const lastDeloadWeeksAgo = (() => {
    for (let i = WEEKS - 1; i >= 0; i--) if (weeklyStats[i].isDeload) return WEEKS - 1 - i;
    return null;
  })();

  // ---- 1RM trend + progress rate + deload markers, for selected exercise ----
  const fullSeries = useMemo(() => buildOneRmSeries(exRows), [exerciseId]);
  const oneRmSeries = useMemo(
    () =>
      fullSeries
        .filter((p) => new Date(p.rawDate) >= cutoff)
        .map((p) => ({ ...p, isDeload: weeklyStats[p.weekIndex]?.isDeload })),
    [fullSeries, cutoff, weeklyStats]
  );
  const progressRate = linregSlope(oneRmSeries.map((p, i) => ({ x: i, y: p.oneRm })));
  const progressRatePct = oneRmSeries.length && oneRmSeries[0].oneRm ? (progressRate / oneRmSeries[0].oneRm) * 100 : 0;

  // ---- Volume by muscle group (stacked over weeks) ----
  const volumeByMuscle = useMemo(() => {
    const weeks = {};
    inPeriod.forEach((r) => {
      const wk = fmtDate(r.completed_at);
      weeks[wk] = weeks[wk] || { week: wk };
      weeks[wk][r.muscle_group] = (weeks[wk][r.muscle_group] || 0) + r.weight_kg * r.reps;
    });
    return Object.values(weeks);
  }, [inPeriod]);
  const muscleGroups = [...new Set(inPeriod.map((r) => r.muscle_group))];

  // ---- RPE / fatigue trend for selected exercise ----
  const rpeSeries = useMemo(() => {
    const bySession = {};
    exRows
      .filter((r) => new Date(r.completed_at) >= cutoff)
      .forEach((r) => {
        const key = r.set_id.split("-s")[0];
        bySession[key] = bySession[key] || { sum: 0, n: 0, date: r.completed_at };
        bySession[key].sum += r.rpe;
        bySession[key].n += 1;
      });
    return Object.values(bySession)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((s) => ({ date: fmtDate(s.date), rpe: Math.round((s.sum / s.n) * 10) / 10 }));
  }, [exerciseId, cutoff]);

  // ---- Inter-session recovery time, by muscle group ----
  const recoveryByMuscle = useMemo(() => {
    const map = {};
    inPeriod.forEach((r) => {
      map[r.muscle_group] = map[r.muscle_group] || new Set();
      map[r.muscle_group].add(r.completed_at.slice(0, 10));
    });
    return Object.entries(map).map(([mg, datesSet]) => {
      const dates = [...datesSet].sort();
      if (dates.length < 2) return { muscle_group: mg, avgDays: null };
      let totalGap = 0;
      for (let i = 1; i < dates.length; i++) totalGap += (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
      return { muscle_group: mg, avgDays: Math.round((totalGap / (dates.length - 1)) * 10) / 10 };
    });
  }, [inPeriod]);
  const selectedRecovery = recoveryByMuscle.find((x) => x.muscle_group === exercise.muscle_group);
  const recoveryRisk = selectedRecovery?.avgDays != null && selectedRecovery.avgDays < 2;

  // ---- Recent sets table ----
  const recentSets = [...inPeriod].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 8);

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
              <p className="text-xs text-[#8A919C]">Progress across {WEEKS} weeks · sample data</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-1.5 text-xs text-[#8A919C] border border-[#232830] hover:border-[#3A414C] rounded-lg px-3 py-2 transition-colors"
            >
              <Database size={13} /> Data source
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

        {/* KPI Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Flame} label="Total Volume" value={Math.round(totalVolume).toLocaleString()} unit="kg" delta={volumeDelta} accent="#F4B740" />
          <KpiCard
            icon={Trophy}
            label={`Best 1RM · ${exercise.title.split(" ").slice(-1)}`}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard
              icon={Rocket}
              label={`Progress Rate · ${exercise.title.split(" ").slice(-1)}`}
              value={`${progressRate >= 0 ? "+" : ""}${progressRate.toFixed(1)}`}
              unit="kg/wk"
              accent={progressRate >= 0 ? "#4FD1C5" : "#EF7B57"}
              subtitle={`${progressRatePct >= 0 ? "+" : ""}${progressRatePct.toFixed(1)}% per week`}
              subtitleColor={progressRate >= 0 ? "#4FD1C5" : "#EF7B57"}
            />
            <MetricCard
              icon={Gauge}
              label="ACWR (this week)"
              value={currentAcwr.toFixed(2)}
              unit=""
              accent={acwrInfo.color}
              subtitle={acwrInfo.label}
              subtitleColor={acwrInfo.color}
            />
            <MetricCard
              icon={Timer}
              label={`Recovery · ${exercise.muscle_group}`}
              value={selectedRecovery?.avgDays ?? "—"}
              unit={selectedRecovery?.avgDays ? "days avg" : ""}
              accent={recoveryRisk ? "#EF7B57" : "#7FA6FF"}
              subtitle={recoveryRisk ? "Below 48h — overtraining risk" : "Between same-muscle sessions"}
              subtitleColor={recoveryRisk ? "#EF7B57" : "#8A919C"}
            />
          </div>
        </div>

        {/* 1RM Trend */}
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold">Progressive Overload — Est. 1RM</h2>
              <p className="text-xs text-[#8A919C]">Gold dot = new PR · dashed ring = deload week</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setExOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs bg-[#0C0E12] border border-[#232830] rounded-lg px-3 py-1.5"
              >
                {exercise.title} <ChevronDown size={13} />
              </button>
              {exOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-lg border border-[#232830] bg-[#1B1F26] shadow-xl z-10 overflow-hidden">
                  {EXERCISES.map((e) => (
                    <button
                      key={e.work_id}
                      onClick={() => {
                        setExerciseId(e.work_id);
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
                    <g key={`dot-${index}`}>
                      {payload.isDeload && <circle cx={cx} cy={cy} r={7} fill="none" stroke="#7FA6FF" strokeWidth={1.5} strokeDasharray="2 2" />}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={payload.isPR ? 5 : 3}
                        fill={payload.isPR ? "#F4B740" : "#0C0E12"}
                        stroke="#F4B740"
                        strokeWidth={payload.isPR ? 0 : 2}
                      />
                    </g>
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ACWR */}
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-1">Training Load — Acute:Chronic Workload Ratio</h2>
          <p className="text-xs text-[#8A919C] mb-4">This week's total volume (all lifts) vs trailing 4-week average</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={visibleWeeklyStats.map((w) => ({ ...w, label: fmtDate(w.date) }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#1E222A" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8A919C", fontSize: 10 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
              <YAxis domain={[0, 1.8]} tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={false} tickLine={false} />
              <ReferenceArea y1={0} y2={0.8} fill="#7FA6FF" fillOpacity={0.08} />
              <ReferenceArea y1={0.8} y2={1.3} fill="#4FD1C5" fillOpacity={0.08} />
              <ReferenceArea y1={1.3} y2={1.5} fill="#F4B740" fillOpacity={0.1} />
              <ReferenceArea y1={1.5} y2={1.8} fill="#EF7B57" fillOpacity={0.1} />
              <Tooltip content={<CustomTooltip suffix="" />} />
              <Line
                type="monotone"
                dataKey="acwr"
                name="ACWR"
                stroke="#E7E9EC"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload, index } = props;
                  return (
                    <circle
                      key={`acwr-dot-${index}`}
                      cx={cx}
                      cy={cy}
                      r={payload.isDeload ? 5 : 3}
                      fill={payload.isDeload ? "#0C0E12" : "#E7E9EC"}
                      stroke={payload.isDeload ? "#F4B740" : "none"}
                      strokeWidth={payload.isDeload ? 2 : 0}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] text-[#8A919C]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#7FA6FF" }} /> Low stimulus</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#4FD1C5" }} /> Sweet spot</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#F4B740" }} /> Caution</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#EF7B57" }} /> High risk</span>
            <span className="flex items-center gap-1 ml-auto">
              <span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "#F4B740" }} /> Deload week
            </span>
          </div>
          {deloadWeeksVisible.length > 0 && (
            <p className="text-[10.5px] text-[#8A919C] mt-2">
              Deload detected: {deloadWeeksVisible.map((w) => fmtDate(w.date)).join(", ")}
              {lastDeloadWeeksAgo !== null && ` · most recent ${lastDeloadWeeksAgo === 0 ? "this week" : `${lastDeloadWeeksAgo} wk ago`}`}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Volume by muscle group */}
          <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
            <h2 className="text-sm font-semibold mb-1">Volume by Muscle Group</h2>
            <p className="text-xs text-[#8A919C] mb-4">Weekly kg lifted, stacked by muscle group</p>
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
            <div className="flex flex-wrap gap-3 mt-3">
              {muscleGroups.map((mg) => (
                <div key={mg} className="flex items-center gap-1.5 text-[11px] text-[#8A919C]">
                  <span className="w-2 h-2 rounded-full" style={{ background: MUSCLE_COLORS[mg] || "#8A919C" }} />
                  {mg}
                </div>
              ))}
            </div>
          </div>

          {/* RPE / fatigue */}
          <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
            <h2 className="text-sm font-semibold mb-1">Fatigue — RPE Trend</h2>
            <p className="text-xs text-[#8A919C] mb-4">Avg RPE per session for {exercise.title}</p>
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
            <p className="text-[10px] text-[#8A919C] mt-2">Dashed line marks RPE 9 — high fatigue zone</p>
          </div>
        </div>

        {/* Recent sets table */}
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-3">Recent Sets</h2>
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
                  <tr key={r.id} className={i % 2 ? "bg-[#0F1216]" : ""}>
                    <td className="py-2 pr-3 text-[#8A919C] whitespace-nowrap">
                      {fmtDate(r.completed_at)}
                      {weeklyStats[r._weekIndex]?.isDeload && (
                        <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] bg-[#7FA6FF]/15 text-[#7FA6FF]">Deload</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{r.title}</td>
                    <td className="py-2 pr-3">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: `${MUSCLE_COLORS[r.muscle_group]}22`, color: MUSCLE_COLORS[r.muscle_group] }}
                      >
                        {r.muscle_group}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.weight_kg} kg</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.reps}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.rpe}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{estOneRM(r.weight_kg, r.reps)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Setup / data source modal */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowSetup(false)}>
          <div className="max-w-lg w-full rounded-xl border border-[#232830] bg-[#15181D] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Database size={15} color="#F4B740" /> Data source
              </h3>
              <button onClick={() => setShowSetup(false)}>
                <X size={16} color="#8A919C" />
              </button>
            </div>
            <p className="text-xs text-[#8A919C] mb-3">
              This dashboard currently reads generated sample rows shaped exactly like your <code className="text-[#E7E9EC]">workout_log</code> table.
              Swap in your live Supabase project by replacing <code className="text-[#E7E9EC]">fetchWorkoutLogs()</code>:
            </p>
            <pre className="text-[10.5px] leading-relaxed bg-[#0C0E12] border border-[#232830] rounded-lg p-3 overflow-x-auto text-[#8FC7B3]">
{`import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function fetchWorkoutLogs() {
  const { data, error } = await supabase
    .from('workout_log')
    .select('*')
    .order('completed_at', { ascending: true });
  if (error) throw error;
  return data;
}`}
            </pre>
            <p className="text-[10.5px] text-[#8A919C] mt-3">
              Set <code className="text-[#E7E9EC]">VITE_SUPABASE_URL</code> and <code className="text-[#E7E9EC]">VITE_SUPABASE_ANON_KEY</code> as
              environment variables in your hosting provider — never hardcode the anon key in source. The load metrics above group rows by
              calendar week client-side, so no extra columns are needed in the table.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
