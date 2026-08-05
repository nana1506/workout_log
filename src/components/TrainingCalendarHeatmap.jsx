import React, { useMemo } from "react";
import { Flame, Calendar, Activity } from "lucide-react";

// Helper to find Monday of the week containing a date
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(date.setDate(diff));
  mon.setHours(0, 0, 0, 0);
  return mon;
};

// Helper to format date as YYYY-MM-DD
const formatDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function TrainingCalendarHeatmap({ data = {}, anchorDate = new Date() }) {
  const WEEKS_TO_SHOW = 16;
  const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Generate grid structure: 16 weeks, Monday to Sunday
  const { weeks, monthLabels } = useMemo(() => {
    const mondayOfCurrentWeek = getMonday(anchorDate);
    const startMonday = new Date(mondayOfCurrentWeek.getTime() - (WEEKS_TO_SHOW - 1) * 7 * 24 * 60 * 60 * 1000);

    const generatedWeeks = [];
    const generatedMonthLabels = []; // Array of { index, text }

    let lastMonth = -1;

    for (let w = 0; w < WEEKS_TO_SHOW; w++) {
      const weekMonday = new Date(startMonday.getTime() + w * 7 * 24 * 60 * 60 * 1000);
      const weekDays = [];

      // Check if this week represents a new month
      const monthIdx = weekMonday.getMonth();
      if (monthIdx !== lastMonth) {
        generatedMonthLabels.push({ index: w, text: MONTHS[monthIdx] });
        lastMonth = monthIdx;
      }

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(weekMonday.getTime() + d * 24 * 60 * 60 * 1000);
        weekDays.push(cellDate);
      }
      generatedWeeks.push(weekDays);
    }

    return { weeks: generatedWeeks, monthLabels: generatedMonthLabels };
  }, [anchorDate]);

  // Coloring levels map
  const levelColors = {
    rest: "bg-[#15181D] border border-[#232830]",
    light: "bg-[#4FD1C5]/30 border border-[#4FD1C5]/40 hover:border-[#4FD1C5]",
    moderate: "bg-[#F4B740]/60 border border-[#F4B740]/70 hover:border-[#F4B740]",
    high: "bg-[#EF7B57]/80 border border-[#EF7B57]/90 hover:border-[#EF7B57]",
    "very-high": "bg-[#E11D48] border border-[#E11D48] hover:border-white",
  };

  const levelLabels = {
    rest: "Rest Day",
    light: "Light Load",
    moderate: "Moderate Load",
    high: "High Load",
    "very-high": "Very High Load",
  };

  return (
    <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232830] pb-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[#F4B740]" />
          <div>
            <h3 className="text-sm font-semibold text-[#E7E9EC]">Daily Training Load</h3>
            <p className="text-[10px] text-[#8A919C]">Fatigue index based on historical rolling volume</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[#8A919C]">
          <Flame size={13} className="text-[#EF7B57]" />
          <span>Last 16 Weeks</span>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto pt-2 pb-1 scrollbar-thin">
        <div className="min-w-[620px] flex flex-col space-y-1 select-none">
          {/* Months header */}
          <div className="flex text-[9px] text-[#8A919C] font-mono h-4 relative">
            <div className="w-8 shrink-0" /> {/* Spacer for day labels */}
            <div className="flex-1 flex relative">
              {monthLabels.map((label, idx) => {
                const leftPos = `${(label.index / WEEKS_TO_SHOW) * 100}%`;
                return (
                  <span
                    key={idx}
                    className="absolute"
                    style={{ left: leftPos }}
                  >
                    {label.text}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Days Grid */}
          <div className="flex">
            {/* Days label column */}
            <div className="w-8 shrink-0 flex flex-col justify-between text-[9px] text-[#8A919C] font-mono pr-2 py-0.5 h-[130px]">
              <span>Mon</span>
              <span className="opacity-0">Tue</span>
              <span>Wed</span>
              <span className="opacity-0">Thu</span>
              <span>Fri</span>
              <span className="opacity-0">Sat</span>
              <span>Sun</span>
            </div>

            {/* Weeks Columns */}
            <div className="flex-1 flex justify-between h-[130px]">
              {weeks.map((weekDays, wIdx) => (
                <div key={wIdx} className="flex flex-col justify-between h-full">
                  {weekDays.map((dayDate, dIdx) => {
                    const formattedDate = formatDateStr(dayDate);
                    const dayData = data[formattedDate];
                    const level = dayData ? dayData.level : "rest";
                    const cellColor = levelColors[level];

                    return (
                      <div key={dIdx} className="relative group">
                        {/* Cell Grid Box */}
                        <div
                          className={`w-4 h-4 rounded-sm transition-all duration-150 cursor-pointer ${cellColor}`}
                        />

                        {/* Premium custom tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-40 pointer-events-none">
                          <div className="rounded-lg border border-[#2A2F38] bg-[#1B1F26] p-3 text-[11px] shadow-xl w-60 space-y-2 relative">
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-[#1B1F26] w-0 h-0" />
                            
                            <div className="flex items-center justify-between border-b border-[#2A2F38] pb-1">
                              <span className="text-[#E7E9EC] font-semibold">
                                {dayDate.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-medium tracking-wide uppercase ${
                                  level === "rest"
                                    ? "bg-[#15181D] text-[#8A919C] border border-[#232830]"
                                    : level === "light"
                                    ? "bg-[#4FD1C5]/10 text-[#4FD1C5]"
                                    : level === "moderate"
                                    ? "bg-[#F4B740]/10 text-[#F4B740]"
                                    : level === "high"
                                    ? "bg-[#EF7B57]/10 text-[#EF7B57]"
                                    : "bg-red-500/10 text-red-500"
                                }`}
                              >
                                {levelLabels[level]}
                              </span>
                            </div>

                            {level === "rest" ? (
                              <p className="text-[#8A919C] italic">No training logged. Rest day.</p>
                            ) : (
                              <div className="space-y-1 text-[#8A919C]">
                                <div className="flex justify-between">
                                  <span>Total Volume:</span>
                                  <span className="text-[#E7E9EC] font-bold font-mono">
                                    {dayData.volume.toLocaleString()} kg
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Sets Count:</span>
                                  <span className="text-[#E7E9EC] font-bold font-mono">
                                    {dayData.setCount} sets
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Average RPE:</span>
                                  <span className="text-[#E7E9EC] font-bold font-mono">
                                    {dayData.avgRpe ?? "N/A"}
                                  </span>
                                </div>
                                <div className="pt-1.5 border-t border-[#2A2F38] mt-1.5">
                                  <span className="block text-[9px] uppercase tracking-wider text-[#E7E9EC]/70 mb-1">
                                    Exercises Trained:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {dayData.exercises.map((ex, idx) => (
                                      <span
                                        key={idx}
                                        className="bg-[#0C0E12] border border-[#232830] text-[#E7E9EC] px-1 py-0.5 rounded text-[9px]"
                                      >
                                        {ex}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[10px] text-[#8A919C] pt-2 border-t border-[#232830]">
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <div className="w-3.5 h-3.5 rounded-sm bg-[#15181D] border border-[#232830]" title="Rest" />
          <div className="w-3.5 h-3.5 rounded-sm bg-[#4FD1C5]/30 border border-[#4FD1C5]/40" title="Light" />
          <div className="w-3.5 h-3.5 rounded-sm bg-[#F4B740]/60 border border-[#F4B740]/70" title="Moderate" />
          <div className="w-3.5 h-3.5 rounded-sm bg-[#EF7B57]/80 border border-[#EF7B57]/90" title="High" />
          <div className="w-3.5 h-3.5 rounded-sm bg-[#E11D48] border border-[#E11D48]" title="Very High" />
          <span>More</span>
        </div>
        <span>Hover cells for details</span>
      </div>
    </div>
  );
}
