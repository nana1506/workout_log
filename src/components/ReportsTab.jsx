import React, { useState, useEffect, useCallback } from "react";
import {
  Newspaper, MailCheck, Calendar, ChevronDown, ChevronUp, RefreshCw,
  Sparkles, Trophy, Activity, Flame, Scale, Target, Compass, Clock, CheckCircle2
} from "lucide-react";
import { supabase } from "../App";
import { fmtDate } from "../utils/calculations";
import { getVolumeEquivalent, getAchievementMedal } from "../utils/emailTemplate";

export default function ReportsTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("progress_reports")
        .select("*")
        .not("sent_at", "is", null)
        .order("period_start", { ascending: false });

      if (error) {
        console.error("Error fetching progress reports:", error);
      } else {
        setReports(data || []);
        // Auto-expand the latest report if available
        if (data && data.length > 0 && !expandedId) {
          setExpandedId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Unexpected error loading progress reports:", err);
    } finally {
      setLoading(false);
    }
  }, [expandedId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-[#232830] bg-gradient-to-r from-[#15181D] via-[#1A1E26] to-[#15181D] p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#F4B740]/10 border border-[#F4B740]/30 flex items-center justify-center shrink-0">
            <Newspaper size={22} color="#F4B740" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-[#E7E9EC]" style={{ fontFamily: "'Oswald', sans-serif" }}>
                PROGRESS NEWSLETTERS
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4B740]/10 border border-[#F4B740]/25 text-[#F4B740] font-mono">
                Archived Reports
              </span>
            </div>
            <p className="text-xs text-[#8A919C] mt-0.5">
              Automated weekly and monthly performance digests delivered via email and archived here.
            </p>
          </div>
        </div>

        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1F26] border border-[#232830] text-xs text-[#8A919C] hover:text-[#E7E9EC] hover:bg-[#232830] transition-all self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-[#F4B740]" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Reports List */}
      {loading && reports.length === 0 ? (
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-12 text-center space-y-3">
          <RefreshCw size={24} className="animate-spin text-[#F4B740] mx-auto" />
          <p className="text-xs text-[#8A919C]">Loading archived progress reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#1B1F26] border border-[#232830] flex items-center justify-center mx-auto text-[#8A919C]">
            <MailCheck size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-sm font-semibold text-[#E7E9EC]">No Progress Reports Sent Yet</h3>
            <p className="text-xs text-[#8A919C] leading-relaxed">
              Progress newsletters are scheduled automatically every Monday at 08:00 UTC (Weekly) and on the 1st of each month (Monthly). When a report is dispatched, its full narrative and snapshot will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const isExpanded = expandedId === report.id;
            const content = report.content || {};
            const snapshot = report.metrics_snapshot || {};
            const isWeekly = report.period_type === "weekly";
            const dateRangeLabel = `${fmtDate(report.period_start)} – ${fmtDate(report.period_end)}`;

            return (
              <div
                key={report.id}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  isExpanded
                    ? "border-[#F4B740]/40 bg-[#15181D] shadow-lg"
                    : "border-[#232830] bg-[#15181D]/80 hover:border-[#2E3440] hover:bg-[#15181D]"
                }`}
              >
                {/* Collapsed Row / Card Header */}
                <div
                  onClick={() => toggleExpand(report.id)}
                  className="p-4 md:p-5 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md border shrink-0 ${
                        isWeekly
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : "bg-[#F4B740]/10 text-[#F4B740] border-[#F4B740]/30"
                      }`}
                    >
                      {report.period_type}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#E7E9EC] truncate">
                          {report.subject || `${isWeekly ? "Weekly" : "Monthly"} Progress Newsletter`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#8A919C] mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar size={11} /> {dateRangeLabel}
                        </span>
                        {report.sent_at && (
                          <span className="flex items-center gap-1 text-[#4FD1C5]">
                            <CheckCircle2 size={11} /> Sent {fmtDate(report.sent_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Quick Metric Pills (Desktop) */}
                    {snapshot.summary && (
                      <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-[#8A919C]">
                        <span className="px-2 py-0.5 rounded bg-[#1B1F26] border border-[#232830]">
                          <strong className="text-[#F4B740]">{snapshot.summary.totalVolumeKg?.toLocaleString()}</strong> kg
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#1B1F26] border border-[#232830]">
                          <strong className="text-[#4FD1C5]">{snapshot.summary.sessionCount}</strong> sessions
                        </span>
                        {snapshot.prs && snapshot.prs.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-[#EF7B57]/10 text-[#EF7B57] border border-[#EF7B57]/30">
                            <strong>{snapshot.prs.length}</strong> PRs
                          </span>
                        )}
                      </div>
                    )}

                    <div className="w-7 h-7 rounded-lg bg-[#1B1F26] border border-[#232830] flex items-center justify-center text-[#8A919C]">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="px-4 pb-5 md:px-5 md:pb-6 pt-2 border-t border-[#232830] space-y-5">
                    {/* Key Takeaways / Highlights */}
                    {content.highlights && (
                      <div className="rounded-lg border border-[#F4B740]/30 bg-[#F4B740]/5 p-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F4B740]">
                          <Sparkles size={14} />
                          <span>KEY TAKEAWAYS</span>
                        </div>
                        <p className="text-xs md:text-sm text-[#E7E9EC] leading-relaxed">
                          {content.highlights}
                        </p>
                      </div>
                    )}

                    {/* Metric Quick Stats Snapshot */}
                    {snapshot.summary && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3 rounded-lg bg-[#0C0E12] border border-[#232830]">
                          <span className="text-[10px] text-[#8A919C] uppercase font-semibold block">Volume</span>
                          <span className="text-sm font-semibold font-mono text-[#F4B740]">
                            {snapshot.summary.totalVolumeKg?.toLocaleString()} <span className="text-[10px] font-normal text-[#8A919C]">kg</span>
                          </span>
                          {snapshot.summary.volumeDeltaPct != null && (
                            <span className={`text-[10px] block ${snapshot.summary.volumeDeltaPct >= 0 ? "text-[#4FD1C5]" : "text-[#EF7B57]"}`}>
                              {snapshot.summary.volumeDeltaPct >= 0 ? "+" : ""}{snapshot.summary.volumeDeltaPct}% vs prior
                            </span>
                          )}
                        </div>

                        <div className="p-3 rounded-lg bg-[#0C0E12] border border-[#232830]">
                          <span className="text-[10px] text-[#8A919C] uppercase font-semibold block">Sessions Logged</span>
                          <span className="text-sm font-semibold font-mono text-[#4FD1C5]">
                            {snapshot.summary.sessionCount} <span className="text-[10px] font-normal text-[#8A919C]">workouts</span>
                          </span>
                          <span className="text-[10px] text-[#8A919C] block">
                            {snapshot.summary.totalSets} total sets
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-[#0C0E12] border border-[#232830]">
                          <span className="text-[10px] text-[#8A919C] uppercase font-semibold block">Avg Session RPE</span>
                          <span className="text-sm font-semibold font-mono text-[#7FA6FF]">
                            {snapshot.summary.avgRpe != null ? snapshot.summary.avgRpe : "N/A"} <span className="text-[10px] font-normal text-[#8A919C]">/ 10</span>
                          </span>
                          <span className="text-[10px] text-[#8A919C] block">Exertion load</span>
                        </div>

                        <div className="p-3 rounded-lg bg-[#0C0E12] border border-[#232830]">
                          <span className="text-[10px] text-[#8A919C] uppercase font-semibold block">PRs &amp; Medal</span>
                          <span className="text-sm font-semibold font-mono text-[#EF7B57] flex items-center gap-1">
                            <span>{getAchievementMedal(snapshot.prs?.length || 0).medal}</span>
                            <span>{snapshot.prs?.length || 0} <span className="text-[10px] font-normal text-[#8A919C]">records</span></span>
                          </span>
                          <span className="text-[10px] text-[#8A919C] block">{getAchievementMedal(snapshot.prs?.length || 0).title}</span>
                        </div>
                      </div>
                    )}

                    {/* Fun Hevy-Style Weight Equivalency Banner */}
                    {snapshot.summary?.totalVolumeKg > 0 && (
                      <div className="p-3.5 rounded-lg bg-[#1B1F26] border border-[#F4B740]/25 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-[#E7E9EC]">
                          <span className="text-base">🏋️</span>
                          <span>
                            Lifted <strong>{snapshot.summary.totalVolumeKg?.toLocaleString()} kg</strong> — equivalent to <strong>{getVolumeEquivalent(snapshot.summary.totalVolumeKg).description}</strong>!
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Content Section Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Training Summary */}
                      {content.trainingSummary && (
                        <div className="rounded-lg border border-[#232830] bg-[#0C0E12] p-4 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E7E9EC]">
                            <Flame size={14} color="#F4B740" />
                            <span>Training Load &amp; Volume</span>
                          </div>
                          <p className="text-xs text-[#8A919C] leading-relaxed">
                            {content.trainingSummary}
                          </p>
                        </div>
                      )}

                      {/* Notable Events / PRs */}
                      {content.notableEvents && (
                        <div className="rounded-lg border border-[#232830] bg-[#0C0E12] p-4 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E7E9EC]">
                            <Trophy size={14} color="#EF7B57" />
                            <span>Notable Events &amp; PRs</span>
                          </div>
                          <p className="text-xs text-[#8A919C] leading-relaxed">
                            {content.notableEvents}
                          </p>
                        </div>
                      )}

                      {/* Muscle Balance */}
                      {content.muscleBalance && (
                        <div className="rounded-lg border border-[#232830] bg-[#0C0E12] p-4 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E7E9EC]">
                            <Scale size={14} color="#4FD1C5" />
                            <span>Muscle Balance &amp; Symmetry</span>
                          </div>
                          <p className="text-xs text-[#8A919C] leading-relaxed">
                            {content.muscleBalance}
                          </p>
                        </div>
                      )}

                      {/* Goal Progress */}
                      {content.goalProgress && (
                        <div className="rounded-lg border border-[#232830] bg-[#0C0E12] p-4 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E7E9EC]">
                            <Target size={14} color="#7FA6FF" />
                            <span>Goal Progression</span>
                          </div>
                          <p className="text-xs text-[#8A919C] leading-relaxed">
                            {content.goalProgress}
                          </p>
                        </div>
                      )}

                      {/* Body Composition (if present) */}
                      {content.bodyComposition && (
                        <div className="rounded-lg border border-[#232830] bg-[#0C0E12] p-4 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E7E9EC]">
                            <Activity size={14} color="#4FD1C5" />
                            <span>Body Composition</span>
                          </div>
                          <p className="text-xs text-[#8A919C] leading-relaxed">
                            {content.bodyComposition}
                          </p>
                        </div>
                      )}

                      {/* Looking Ahead */}
                      {content.lookingAhead && (
                        <div className="rounded-lg border border-[#232830] bg-[#0C0E12] p-4 space-y-2 md:col-span-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E7E9EC]">
                            <Compass size={14} color="#F4B740" />
                            <span>Looking Ahead &amp; Coach's Advice</span>
                          </div>
                          <p className="text-xs text-[#8A919C] leading-relaxed">
                            {content.lookingAhead}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
