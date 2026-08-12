import React from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  Flame, Trophy, Activity, CalendarCheck, Rocket, Gauge,
  Download, ChevronDown, ChevronLeft, ChevronRight
} from "lucide-react";
import { KpiCard, MetricCard, CustomTooltip, RadarTooltip } from "./shared/SharedWidgets";
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
  exportToCSV
}) {
  return (
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

      {/* Volume by Muscle Group Card */}
      <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 md:p-5 relative z-0">
        <h2 className="text-sm font-semibold mb-3">Volume by Muscle Group</h2>
        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeByMuscleGroupData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1E222A" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: "#8A919C", fontSize: 10 }} axisLine={{ stroke: "#232830" }} tickLine={false} />
              <YAxis tick={{ fill: "#8A919C", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip suffix=" kg" />} />
              {Object.keys(MUSCLE_COLORS).map((mg) => (
                <Bar key={mg} dataKey={mg} stackId="vol" fill={MUSCLE_COLORS[mg] || "#8A919C"} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
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
    </>
  );
}
