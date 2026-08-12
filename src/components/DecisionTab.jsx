import React, { useState, useEffect } from "react";
import {
  Brain, Timer, CheckCircle2, ChevronRight, AlertTriangle,
  Activity, Flame, Trophy, Rocket, Plus, X, Trash2, Calendar, Target
} from "lucide-react";
import { fmtDate, getTrainingSplit, getHistorySlope } from "../utils/calculations";
import { supabase } from "../App";

export default function DecisionTab({
  recoveryStatus,
  aiCoachingLoading,
  aiCoaching,
  musclePriorities,
  blockAssessmentLoading,
  blockAssessment,
  weeklyStats,
  fatigueInfo,
  trainingGoals = [],
  onRefreshGoals,
  exercisesList = [],
  bodyMetrics = []
}) {
  // Goal form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [goalType, setGoalType] = useState("body_weight");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const latestMetric = bodyMetrics[0];
  const latestWeight = latestMetric ? Number(latestMetric.weight_kg) : 0;
  const latestMusclePct = latestMetric ? Number(latestMetric.muscle_mass_pct) : 0;

  // 1. Auto-achievement check effect
  useEffect(() => {
    const checkAndAchieveGoals = async () => {
      const activeGoals = trainingGoals.filter(g => g.status === 'active');
      if (!latestMetric) return;

      for (const goal of activeGoals) {
        let isAchieved = false;
        let currentValue = 0;

        if (goal.goal_type === 'body_weight') {
          currentValue = latestWeight;
          const isBulk = Number(goal.target_value) > (Number(goal.starting_value) || 0);
          if (isBulk) {
            isAchieved = currentValue >= Number(goal.target_value);
          } else {
            isAchieved = currentValue <= Number(goal.target_value);
          }
        } else if (goal.goal_type === 'muscle_mass_pct') {
          currentValue = latestMusclePct;
          isAchieved = currentValue >= Number(goal.target_value);
        }

        if (isAchieved && currentValue > 0) {
          try {
            const { error } = await supabase
              .from('training_goals')
              .update({ status: 'achieved' })
              .eq('id', goal.id);

            if (error) {
              console.error("Error auto-achieving goal:", error);
            } else {
              console.log(`Goal ${goal.id} auto-achieved!`);
              onRefreshGoals();
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    };

    checkAndAchieveGoals();
  }, [trainingGoals, bodyMetrics, latestWeight, latestMusclePct, latestMetric, onRefreshGoals]);

  // Handle goal creation
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!targetValue || isNaN(targetValue)) {
      setFormError("Please enter a valid target value.");
      return;
    }

    setFormError("");
    setIsSaving(true);

    try {
      const startingVal = goalType === "body_weight" ? latestWeight : latestMusclePct;
      const targetLabel = goalType === "body_weight" ? "Body Weight" : "Muscle Mass %";

      const { error } = await supabase
        .from('training_goals')
        .insert({
          goal_type: goalType,
          target_label: targetLabel,
          target_value: Number(targetValue),
          target_date: targetDate || null,
          starting_value: startingVal || null,
          status: 'active'
        });

      if (error) {
        setFormError(error.message || "Failed to save goal.");
      } else {
        setTargetValue("");
        setTargetDate("");
        setShowAddForm(false);
        onRefreshGoals();
      }
    } catch (err) {
      setFormError("An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle goal soft-delete (abandon)
  const handleAbandonGoal = async (goalId) => {
    if (!confirm("Are you sure you want to abandon this goal?")) return;
    try {
      const { error } = await supabase
        .from('training_goals')
        .update({ status: 'abandoned' })
        .eq('id', goalId);

      if (error) {
        console.error("Failed to abandon goal:", error);
      } else {
        onRefreshGoals();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
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
                  <div className="flex justify-between text-[10px] text-[#8A919C]">
                    <span>Systemic Recovery Status</span>
                    <span>{Math.round(recoveryStatus.pct)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0C0E12] rounded-full overflow-hidden border border-[#232830]">
                    <div
                      className="h-full bg-gradient-to-r from-[#4FD1C5] to-[#F4B740] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, recoveryStatus.pct))}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-2 text-xs text-[#8A919C]">
                Loading recovery telemetry...
              </div>
            )}
          </div>

          {/* Muscle Priority Breakdown list */}
          <div className="space-y-2 pt-2 border-t border-[#232830]">
            <span className="text-[10px] uppercase font-bold text-[#8A919C] tracking-wide block">Individual Recovery Focus</span>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {musclePriorities.fullyRecovered.map(m => (
                <div key={m.muscle} className="flex items-center justify-between text-xs p-1.5 rounded bg-[#0C0E12]/50 border border-[#1E222A]">
                  <span className="capitalize font-medium">{m.muscle}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#8A919C]">{m.daysSince}d since training</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] bg-[#4FD1C5]/10 text-[#4FD1C5] border border-[#4FD1C5]/20 font-semibold">READY</span>
                  </div>
                </div>
              ))}
              {musclePriorities.recovering.map(m => (
                <div key={m.muscle} className="flex items-center justify-between text-xs p-1.5 rounded bg-[#0C0E12]/50 border border-[#1E222A]">
                  <span className="capitalize font-medium">{m.muscle}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#8A919C]">{m.hoursRemaining.toFixed(0)}h left</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] bg-[#F4B740]/10 text-[#F4B740] border border-[#F4B740]/20 font-semibold">RECOVERING</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: AI Deload & Block Assessment */}
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#8A919C]">AI Block &amp; Deload Assessment</span>
              <Brain size={16} className="text-[#F4B740]" />
            </div>
            
            {blockAssessmentLoading ? (
              <div className="space-y-3 pt-2">
                <div className="h-4 bg-[#8A919C]/20 rounded w-3/4 animate-pulse" />
                <div className="h-12 bg-[#8A919C]/20 rounded w-full animate-pulse" />
              </div>
            ) : blockAssessment ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    blockAssessment.deloadRecommended
                      ? "bg-[#EF7B57]/10 text-[#EF7B57] border border-[#EF7B57]/20"
                      : "bg-[#4FD1C5]/10 text-[#4FD1C5] border border-[#4FD1C5]/20"
                  }`}>
                    {blockAssessment.deloadRecommended ? "Deload Suggested" : "Block Normal"}
                  </span>
                  {blockAssessment.deloadWindow && (
                    <span className="text-xs text-[#8A919C]">
                      Target Window: <strong className="text-[#E7E9EC]">{blockAssessment.deloadWindow}</strong>
                    </span>
                  )}
                </div>
                
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#E7E9EC] block">{blockAssessment.phaseAssessment}</span>
                  <p className="text-xs text-[#8A919C] leading-relaxed">{blockAssessment.reasoning}</p>
                </div>
              </div>
            ) : (
              <div className="pt-2 text-xs text-[#8A919C]">
                {weeklyStats.length < 3 ? "Complete at least 3 weeks of training to calculate block status." : "Awaiting analysis telemetry..."}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#232830] text-[10px] text-[#8A919C] flex items-center gap-1">
            <AlertTriangle size={12} className="text-[#F4B740]" />
            <span>Updates dynamically based on plateaus, injury risk, and deload frequency.</span>
          </div>
        </div>
      </div>

      {/* Card 3: AI Coaching Recommendations & Workout Split suggestion */}
      <div>
        {fatigueInfo ? (
          <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#232830] pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#E7E9EC]">Next Suggested Workout Session</h3>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    fatigueInfo.fatigueLevel.includes("Danger") 
                      ? "bg-[#EF7B57]/10 text-[#EF7B57] border border-[#EF7B57]/20" 
                      : (fatigueInfo.fatigueLevel.includes("Caution") ? "bg-[#F4B740]/10 text-[#F4B740] border border-[#F4B740]/20" : "bg-[#4FD1C5]/10 text-[#4FD1C5] border border-[#4FD1C5]/20")
                  }`}>
                    {fatigueInfo.fatigueLevel}
                  </span>
                </div>
                <p className="text-xs text-[#8A919C]">
                  Target Focus Muscle: <span className="capitalize text-[#E7E9EC] font-semibold">{musclePriorities.recommended.muscle}</span> (Last trained {fmtDate(musclePriorities.recommended.lastTrained)})
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-start md:self-auto bg-[#0C0E12] rounded-lg p-1.5 border border-[#232830] text-xs font-mono font-semibold text-[#F4B740]">
                <Activity size={14} />
                <span>SPLIT: {getTrainingSplit(musclePriorities.recommended.muscle).split.toUpperCase()}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-[#0C0E12]/50 border border-[#232830] p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#8A919C] tracking-wide block">Next Split Suggestion</span>
                  <span className="text-sm font-semibold text-[#E7E9EC]">
                    {aiCoachingLoading ? (
                      <span className="inline-block w-28 h-4 bg-[#8A919C]/20 rounded animate-pulse" />
                    ) : (
                      aiCoaching?.recommendedSplit || `${getTrainingSplit(musclePriorities.recommended.muscle).split.toUpperCase()} (${getTrainingSplit(musclePriorities.recommended.muscle).detail.toUpperCase()})`
                    )}
                  </span>
                </div>
                <ChevronRight size={16} className="text-[#8A919C]" />
              </div>

              <div className="rounded-lg bg-[#0C0E12]/50 border border-[#232830] p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#8A919C] tracking-wide block">Target recommendation</span>
                  <span className="text-sm font-semibold text-[#F4B740] font-mono">
                    {aiCoachingLoading ? (
                      <span className="inline-block w-20 h-4 bg-[#8A919C]/20 rounded animate-pulse" />
                    ) : (
                      aiCoaching?.targetRecommendation || `Repeat last: ${fatigueInfo.lastWeight} kg x ${fatigueInfo.lastReps} reps`
                    )}
                  </span>
                </div>
                <ChevronRight size={16} className="text-[#8A919C]" />
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

      {/* Card 4: Training Goals Section */}
      <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#232830] pb-3">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-[#F4B740]" />
            <h3 className="text-sm font-semibold text-[#E7E9EC]" style={{ fontFamily: "'Oswald', sans-serif" }}>
              ACTIVE TRAINING GOALS
            </h3>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#F4B740] hover:bg-[#e0a230] text-[#0C0E12] text-xs font-semibold transition-all"
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            <span>{showAddForm ? "Cancel" : "New Goal"}</span>
          </button>
        </div>

        {/* Goal Add Form */}
        {showAddForm && (
          <form onSubmit={handleCreateGoal} className="bg-[#0C0E12]/50 border border-[#232830] rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-[#E7E9EC]">Create Training Goal</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#8A919C] uppercase font-bold">Goal Type</label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  className="bg-[#15181D] border border-[#232830] rounded p-2 text-xs text-[#E7E9EC] focus:border-[#F4B740] outline-none"
                >
                  <option value="body_weight">Body Weight</option>
                  <option value="muscle_mass_pct">Muscle Mass %</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#8A919C] uppercase font-bold">Target Value ({goalType === "body_weight" ? "kg" : "%"})</label>
                <input
                  type="text"
                  placeholder={goalType === "body_weight" ? "e.g. 75" : "e.g. 42.5"}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="bg-[#15181D] border border-[#232830] rounded p-2 text-xs text-[#E7E9EC] placeholder-[#8A919C]/50 focus:border-[#F4B740] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#8A919C] uppercase font-bold">Target Date (Optional)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-[#15181D] border border-[#232830] rounded p-2 text-xs text-[#E7E9EC] focus:border-[#F4B740] outline-none"
                />
              </div>
            </div>

            {formError && <div className="text-xs text-[#EF7B57]">{formError}</div>}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 rounded bg-[#F4B740] hover:bg-[#e0a230] text-[#0C0E12] text-xs font-semibold disabled:opacity-50 transition-all"
              >
                {isSaving ? "Saving..." : "Create Goal"}
              </button>
            </div>
          </form>
        )}

        {/* Goals Grid */}
        {trainingGoals.filter(g => g.status === 'active').length === 0 ? (
          <div className="text-center py-6 text-xs text-[#8A919C]">
            No active goals. Click "New Goal" to get started tracking your bodyweight or muscle mass targets!
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {trainingGoals.filter(g => g.status === 'active').map((goal) => {
              const startVal = Number(goal.starting_value) || 0;
              const targetVal = Number(goal.target_value);
              const currentVal = goal.goal_type === 'body_weight' ? latestWeight : latestMusclePct;

              // Calculate progress percentage securely
              let progressPct = 0;
              if (targetVal !== startVal) {
                progressPct = ((currentVal - startVal) / (targetVal - startVal)) * 100;
              }
              progressPct = Math.min(100, Math.max(0, progressPct));

              // Rate and Pace calculations using calculations.js getHistorySlope
              const dataPoints = bodyMetrics.map(m => ({
                date: m.date,
                value: goal.goal_type === 'body_weight' ? m.weight_kg : m.muscle_mass_pct
              }));
              const slope = getHistorySlope(dataPoints); // change per day
              const weeklyRate = slope * 7;
              const unit = goal.goal_type === 'body_weight' ? 'kg' : '%';

              let paceText = "Calculating pace...";
              let paceColorClass = "text-[#8A919C] bg-[#8A919C]/10 border-[#8A919C]/20";

              if (dataPoints.length < 2 || slope === 0) {
                paceText = "Need more metrics";
              } else {
                const weeklyRateStr = `${weeklyRate >= 0 ? "+" : ""}${weeklyRate.toFixed(2)} ${unit}/wk`;
                
                if (goal.target_date) {
                  const daysRemaining = (new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24);
                  if (daysRemaining <= 0) {
                    paceText = "Overdue";
                    paceColorClass = "text-[#EF7B57] bg-[#EF7B57]/10 border-[#EF7B57]/20";
                  } else {
                    const requiredTotalChange = targetVal - currentVal;
                    const requiredChangePerDay = requiredTotalChange / daysRemaining;

                    const isBulk = targetVal > startVal;
                    let onPace = false;
                    if (isBulk) {
                      onPace = slope >= requiredChangePerDay;
                    } else {
                      onPace = slope <= requiredChangePerDay;
                    }

                    if (onPace) {
                      paceText = `On Pace (${weeklyRateStr})`;
                      paceColorClass = "text-[#4FD1C5] bg-[#4FD1C5]/10 border-[#4FD1C5]/20";
                    } else {
                      paceText = `Behind Pace (${weeklyRateStr})`;
                      paceColorClass = "text-[#EF7B57] bg-[#EF7B57]/10 border-[#EF7B57]/20";
                    }
                  }
                } else {
                  paceText = `Active (${weeklyRateStr})`;
                  paceColorClass = "text-[#7FA6FF] bg-[#7FA6FF]/10 border-[#7FA6FF]/20";
                }
              }

              return (
                <div key={goal.id} className="rounded-lg bg-[#0C0E12]/50 border border-[#232830] p-4 flex flex-col justify-between space-y-3 relative">
                  <button
                    onClick={() => handleAbandonGoal(goal.id)}
                    className="absolute top-3 right-3 text-[#8A919C] hover:text-[#EF7B57] transition-colors"
                    title="Abandon Goal"
                  >
                    <Trash2 size={13} />
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-[#8A919C] tracking-wide">
                        {goal.target_label} Goal
                      </span>
                      <span className={`px-2 py-0.2 rounded-[4px] text-[8px] font-bold uppercase border ${paceColorClass}`}>
                        {paceText}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold font-mono tracking-tight text-[#E7E9EC]">
                          {currentVal || "—"}
                        </span>
                        <span className="text-[10px] text-[#8A919C]">{unit} current</span>
                      </div>
                      <div className="flex items-baseline gap-1 text-[#F4B740]">
                        <span className="text-sm font-bold font-mono">
                          {targetVal}
                        </span>
                        <span className="text-[9px] text-[#F4B740]/80">target</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-[#15181D] rounded-full overflow-hidden border border-[#232830]">
                      <div
                        className="h-full bg-gradient-to-r from-[#F4B740] to-[#4FD1C5] rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-[#8A919C]">
                      <span>Starting: {startVal} {unit}</span>
                      <span>Progress: {Math.round(progressPct)}%</span>
                    </div>
                  </div>

                  {goal.target_date && (
                    <div className="flex items-center gap-1 text-[9px] text-[#8A919C] pt-1">
                      <Calendar size={11} className="text-[#F4B740]" />
                      <span>Target Date: {new Date(goal.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
