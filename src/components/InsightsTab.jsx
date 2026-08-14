import React from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  Flame, Trophy, Activity, CalendarCheck, Rocket, Gauge,
  Download, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle,
  Sparkles, RefreshCw
} from "lucide-react";
import { KpiCard, MetricCard, CustomTooltip, RadarTooltip, VolumeTooltip } from "./shared/SharedWidgets";
import TrainingCalendarHeatmap from "./TrainingCalendarHeatmap";
import { MUSCLE_COLORS } from "../constants";
import { fmtDate, estOneRM } from "../utils/calculations";
import { getMusclesForExercise } from "../utils/muscleMap";

export default function InsightsTab({
  totalVolume,
  volumeDelta,
  selectedExerciseId,
  activeExercise,
  currentBest1RM,
  oneRmDelta,
  avgRpe,
  rpeDelta,
  sessionsCount,
  sessionsDelta,
  overallProgressRateStats,
  currentAcwr,
  acwrInfo,
  radarChartData,
  radarMetric,
  setRadarMetric,
  volumeByMuscleGroupData,
  rpeSeries,
  oneRmSeries,
  selectedExercisePlateauStatus,
  visibleWeeklyStats,
  recentSets,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  sortedTableLogs,
  dailyFatigueMap,
  anchorDate,
  muscleMapLookup,
  handleSort,
  sortColumn,
  sortDirection,
  exportToCSV,
  insightDigest = null,
  insightDigestLoading = false,
  annotationEvents = []
}) {
  const captions = insightDigest?.captions || {};

  return (
    <div className="space-y-6">
      {/* AI Insight Digest Card */}
      <div className="rounded-xl border border-[#F4B740]/30 bg-gradient-to-r from-[#15181D] via-[#1C2028] to-[#15181D] p-4 md:p-5 relative overflow-hidden shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F4B740]/15 border border-[#F4B740]/40 flex items-center justify-center">
              <Sparkles size={16} color="#F4B740" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-[#E7E9EC]">AI INSIGHT DIGEST</h2>
              <p className="text-[10px] text-[#8A919C]">Automated performance &amp; workload summary</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4B740]/10 border border-[#F4B740]/25 text-[#F4B740] font-medium">
            Gemini 3.5 Lite
          </span>
        </div>

        {insightDigestLoading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-[#8A919C] animate-pulse">
            <RefreshCw size={14} className="animate-spin text-[#F4B740]" />
            <span>Analyzing training logs and synthesizing performance narrative...</span>
          </div>
        ) : insightDigest?.narrative ? (
          <div className="space-y-3">
            <p className="text-xs md:text-sm text-[#E7E9EC] leading-relaxed font-normal">
              {insightDigest.narrative}
            </p>

            {/* Annotation Badges / Events List */}
            {annotationEvents.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {annotationEvents.map((evt) => {
                  const captionText = captions[evt.id] || evt.label;
                  let badgeStyle = "bg-[#232830] text-[#E7E9EC] border-[#2A2F38]";
                  if (evt.type === "pr") badgeStyle = "bg-[#F4B740]/10 text-[#F4B740] border-[#F4B740]/30";
                  if (evt.type === "rpe-spike") badgeStyle = "bg-[#7FA6FF]/10 text-[#7FA6FF] border-[#7FA6FF]/30";
                  if (evt.type === "acwr-zone") badgeStyle = "bg-[#EF7B57]/10 text-[#EF7B57] border-[#EF7B57]/30";
                  if (evt.type === "plateau") badgeStyle = "bg-[#F4B740]/15 text-[#F4B740] border-[#F4B740]/40";
                  if (evt.type === "neglected-muscle") badgeStyle = "bg-purple-500/10 text-purple-300 border-purple-500/30";

                  return (
                    <span
                      key={evt.id}
                      className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 font-mono ${badgeStyle}`}
                      title={evt.label}
                    >
                      <span className="font-semibold">{evt.type.toUpperCase()}:</span>
                      <span>{captionText}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#8A919C] py-2">
            Insight will update automatically as new workout logs are registered.
          </p>
        )}
      </div>
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

      {/* Muscle Split Balance Radar Chart Card */}
      <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5 relative z-0">
        <div className="flex flex-col md:grid md:grid-cols-12 gap-6 items-center">
          {/* Left: Radar Chart */}
          <div className="w-full md:col-span-7 flex flex-col items-center">
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                  <PolarGrid stroke="#232830" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#8A919C", fontSize: 10, fontWeight: 500 }} />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 'auto']} 
                    tick={{ fill: "#8A919C", fontSize: 8 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Radar
                    name={radarMetric === "sets" ? "Sets" : "Volume"}
                    dataKey={radarMetric}
                    stroke={radarMetric === "sets" ? "#F4B740" : "#4FD1C5"}
                    fill={radarMetric === "sets" ? "#F4B740" : "#4FD1C5"}
                    fillOpacity={0.15}
                  />
                  <Tooltip content={<RadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Toggle metric */}
            <div className="flex bg-[#0C0E12] rounded-lg p-0.5 border border-[#232830] text-[10px] uppercase font-semibold tracking-wider">
              <button
                onClick={() => setRadarMetric("sets")}
                className={`px-3 py-1 rounded-md transition-all ${
                  radarMetric === "sets" ? "bg-[#1B1F26] text-[#F4B740]" : "text-[#8A919C] hover:text-[#E7E9EC]"
                }`}
              >
                Set Count
              </button>
              <button
                onClick={() => setRadarMetric("volume")}
                className={`px-3 py-1 rounded-md transition-all ${
                  radarMetric === "volume" ? "bg-[#1B1F26] text-[#4FD1C5]" : "text-[#8A919C] hover:text-[#E7E9EC]"
                }`}
              >
                Volume Load
              </button>
            </div>
          </div>

          {/* Right: Legend & Text */}
          <div className="w-full md:col-span-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[#E7E9EC]">Muscle Split Balance</h3>
              <p className="text-[11px] text-[#8A919C] mt-1 leading-relaxed">
                Distribution of stimulus across major target muscle categories. Ensure even development to avoid plateaus and postural imbalances.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {radarChartData.map((item) => (
                <div key={item.subject} className="flex flex-col p-2 bg-[#0C0E12]/50 rounded border border-[#1E222A]">
                  <span className="text-[10px] text-[#8A919C] uppercase font-semibold">{item.subject}</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-mono text-[#F4B740] font-semibold">{item.sets} <span className="text-[9px] font-sans font-normal text-[#8A919C]">sets</span></span>
                    <span className="font-mono text-[#4FD1C5] text-[10px]">{Math.round(item.volume / 1000)}k <span className="text-[9px] font-sans text-[#8A919C]">kg</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Volume & RPE Trend Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-0">
        {/* Volume by muscle group */}
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-1">Volume by Muscle Group</h2>
          <p className="text-xs text-[#8A919C] mb-4">Weekly kg lifted across categories</p>
          <div className="w-full h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeByMuscleGroupData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#1E222A" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: "#8A919C", fontSize: 10 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
                <YAxis tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<VolumeTooltip annotationEvents={annotationEvents} captions={captions} />} />
                {Object.keys(MUSCLE_COLORS).map((mg) => {
                  const isNeglected = annotationEvents.some(
                    (e) => e.type === "neglected-muscle" && (e.id === `neglected-${mg}` || e.muscle === mg)
                  );
                  return (
                    <Bar
                      key={mg}
                      dataKey={mg}
                      stackId="vol"
                      fill={MUSCLE_COLORS[mg] || "#8A919C"}
                      fillOpacity={isNeglected ? 0.6 : 1}
                      stroke={isNeglected ? "#EF7B57" : "none"}
                      strokeWidth={isNeglected ? 1.5 : 0}
                      radius={[2, 2, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fatigue — RPE Trend */}
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-1">Fatigue — RPE Trend</h2>
          <p className="text-xs text-[#8A919C] mb-4">
            Avg RPE per session for {selectedExerciseId === "all" ? "Overall Workouts" : activeExercise.title}
          </p>
          <div className="w-full h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rpeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                {annotationEvents
                  .filter((e) => e.type === "rpe-spike")
                  .map((e) => (
                    <ReferenceLine
                      key={e.id}
                      x={e.date}
                      stroke="#7FA6FF"
                      strokeDasharray="2 2"
                      label={{
                        value: captions[e.id] || "Spike",
                        fill: "#7FA6FF",
                        fontSize: 9,
                        position: "top",
                      }}
                    />
                  ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={oneRmSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        <div className="w-full h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibleWeeklyStats.filter(w => w.date).map((w) => ({ ...w, label: fmtDate(w.date) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1E222A" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8A919C", fontSize: 10 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
              <YAxis domain={[0, 1.8]} tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={false} tickLine={false} />
              <ReferenceArea y1={0} y2={0.8} fill="#7FA6FF" fillOpacity={0.08} />
              <ReferenceArea y1={0.8} y2={1.3} fill="#4FD1C5" fillOpacity={0.08} />
              <ReferenceArea y1={1.3} y2={1.5} fill="#F4B740" fillOpacity={0.1} />
              <ReferenceArea y1={1.5} y2={1.8} fill="#EF7B57" fillOpacity={0.1} />
              <Tooltip content={<CustomTooltip suffix="" />} />
              <Line type="monotone" dataKey="acwr" name="ACWR" stroke="#E7E9EC" strokeWidth={2} />
              {annotationEvents
                .filter((e) => e.type === "acwr-zone")
                .map((e) => {
                  const labelDate = fmtDate(e.date);
                  return (
                    <ReferenceLine
                      key={e.id}
                      x={labelDate}
                      stroke="#EF7B57"
                      strokeDasharray="3 3"
                      label={{
                        value: captions[e.id] || e.zone,
                        fill: "#EF7B57",
                        fontSize: 9,
                        position: "insideTopRight",
                      }}
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Log Records Table (Sortable headers added) */}
      <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5 relative z-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold">Live Log Records</h2>
          <button
            onClick={() => exportToCSV(sortedTableLogs, activeExercise.title)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#1B1F26] border border-[#232830] text-xs font-semibold hover:bg-[#232830] hover:text-[#E7E9EC] transition-all"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
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
                <th className="py-2 pr-3 font-medium text-[#8A919C]">
                  Secondary
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
                  <td className="py-2 pr-3">
                    {(() => {
                      const secondaryMuscles = getMusclesForExercise(r.title || r.work_id, muscleMapLookup, r.muscle_group)
                        .filter(m => m.role === 'secondary');
                      if (secondaryMuscles.length === 0) {
                        return <span className="text-[#8A919C]">—</span>;
                      }
                      return (
                        <div className="flex flex-wrap gap-1">
                          {secondaryMuscles.map((sm, idx) => (
                            <span
                              key={idx}
                              className="px-1 py-0.2 rounded text-[9px] whitespace-nowrap"
                              style={{
                                background: `${MUSCLE_COLORS[sm.muscle_group] || "#8A919C"}22`,
                                color: MUSCLE_COLORS[sm.muscle_group] || "#8A919C"
                              }}
                            >
                              {sm.muscle_group}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
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
              className="bg-[#1B1F26] border border-[#232830] rounded px-1.5 py-0.5 text-xs text-[#E7E9EC] outline-none"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Showing Page <strong className="text-[#E7E9EC] font-semibold">{currentPage}</strong> of{" "}
              <strong className="text-[#E7E9EC] font-semibold">
                {Math.ceil(sortedTableLogs.length / pageSize) || 1}
              </strong>{" "}
              ({sortedTableLogs.length} total rows)
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

      <TrainingCalendarHeatmap data={dailyFatigueMap} anchorDate={anchorDate} />
    </div>
  );
}
