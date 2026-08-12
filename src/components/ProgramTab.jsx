import React, { useState, useMemo } from "react";
import {
  Calendar, CalendarCheck, Clipboard, Clock, CheckCircle2,
  AlertTriangle, Play, Settings, Plus, Trash2, Edit2, ChevronUp, ChevronDown,
  Info, Search, Award, RefreshCw, X, Check
} from "lucide-react";
import { supabase } from "../App";
import { detectPlateau, detectInjuryRisk } from "../utils/analysis";
import { buildOneRmSeries } from "../utils/calculations";

export default function ProgramTab({
  programsWithDays = [],
  exercisesList = [],
  rawLogs = [],
  onRefresh
}) {
  // Navigation & Form UI states
  const [showForm, setShowForm] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState(null);
  
  // New/Edit Program Form State
  const [programName, setProgramName] = useState("");
  const [scheduleType, setScheduleType] = useState("fixed_days"); // "fixed_days" | "rotating_cycle"
  const [days, setDays] = useState([]); // Array of { id, name, weekday, day_order, exercises: [] }
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Dismissed suggestions local tracking
  const [dismissedSuggestions, setDismissedSuggestions] = useState(new Set());
  const [isUpdatingProgression, setIsUpdatingProgression] = useState(false);

  // Active Program derivation
  const activeProgram = useMemo(() => {
    return programsWithDays.find(p => p.is_active);
  }, [programsWithDays]);

  // Derive today's date string (YYYY-MM-DD) in local time
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Today's weekday string in local time (e.g. "Mon")
  const todayWeekday = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date());
  }, []);

  // 1. Determine today's day in rotating cycle
  const todayRotatingDay = useMemo(() => {
    if (!activeProgram || activeProgram.schedule_type !== 'rotating_cycle' || !activeProgram.days.length) {
      return null;
    }
    const sortedDays = [...activeProgram.days].sort((a, b) => (a.day_order || 0) - (b.day_order || 0));
    
    // Group raw logs by local date YYYY-MM-DD
    const logsByDate = {};
    rawLogs.forEach(log => {
      if (!log.completed_at) return;
      const dateStr = log.completed_at.slice(0, 10);
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = new Set();
      }
      logsByDate[dateStr].add((log.title || log.work_id || "").trim().toLowerCase());
    });
    
    // Sort dates backwards chronologically
    const sortedDates = Object.keys(logsByDate).sort().reverse();
    
    // Find the most recent date where a program day was matched-complete
    for (const dateStr of sortedDates) {
      const loggedExercises = logsByDate[dateStr];
      for (const day of sortedDays) {
        if (!day.exercises || day.exercises.length === 0) continue;
        const allExercisesLogged = day.exercises.every(ex => 
          loggedExercises.has(ex.exercise_title.trim().toLowerCase())
        );
        if (allExercisesLogged) {
          // This day was completed on dateStr. Schedule the next day index in line.
          const currentIndex = sortedDays.findIndex(d => d.id === day.id);
          const nextIndex = (currentIndex + 1) % sortedDays.length;
          return sortedDays[nextIndex];
        }
      }
    }
    
    // Default to the first day in sequence
    return sortedDays[0];
  }, [activeProgram, rawLogs]);

  // 2. Identify the active program day matching today's criteria
  const todayProgramDay = useMemo(() => {
    if (!activeProgram) return null;
    if (activeProgram.schedule_type === 'fixed_days') {
      return activeProgram.days.find(d => d.weekday === todayWeekday) || null;
    }
    return todayRotatingDay;
  }, [activeProgram, todayWeekday, todayRotatingDay]);

  // 3. Match today's workout logs against the todayProgramDay exercises
  const todayExercisesStatus = useMemo(() => {
    if (!todayProgramDay || !todayProgramDay.exercises) return [];

    return todayProgramDay.exercises.map(ex => {
      // Find logs matching today's date and exercise title
      const todayExerciseLogs = rawLogs.filter(log => 
        log.completed_at?.slice(0, 10) === todayStr &&
        (log.title || log.work_id || "").trim().toLowerCase() === ex.exercise_title.trim().toLowerCase()
      );

      const loggedSets = todayExerciseLogs.length;
      const targetSets = ex.target_sets;
      
      // Calculate how many sets met/exceeded both reps and weight target
      const setsMeetingTarget = todayExerciseLogs.filter(log => 
        (log.reps || 0) >= ex.target_reps &&
        (log.weight_kg || 0) >= (ex.target_weight_kg || 0)
      ).length;

      // Fully complete means you logged at least the target number of sets,
      // and each of those sets met the targets
      const isFullyComplete = loggedSets >= targetSets && setsMeetingTarget >= targetSets;

      // Calculate progression recommendation if fully complete
      let progressionSuggestion = null;
      if (isFullyComplete) {
        const exerciseLogs = rawLogs.filter(log => 
          (log.title || log.work_id || "").trim().toLowerCase() === ex.exercise_title.trim().toLowerCase()
        );
        const oneRmSeries = buildOneRmSeries(exerciseLogs, false);
        const plateauStatus = detectPlateau(oneRmSeries, 5, 0.015);
        const injuryRisk = detectInjuryRisk(exerciseLogs);
        const currentWeight = Number(ex.target_weight_kg) || 0;
        const isInjuryRisk = injuryRisk && injuryRisk.level && injuryRisk.level !== "none";

        if (!isInjuryRisk && !plateauStatus.isPlateaued) {
          // Progression increment: +2.5% rounded to nearest 0.5kg or 2.5kg
          let increment = 2.5;
          if (currentWeight > 0) {
            const rawSuggested = currentWeight * 1.025;
            if (currentWeight < 40) {
              increment = Math.round(rawSuggested) - currentWeight;
            } else {
              increment = (Math.round(rawSuggested / 2.5) * 2.5) - currentWeight;
            }
          }
          if (increment <= 0) increment = 2.5;
          const nextWeight = currentWeight + increment;

          progressionSuggestion = {
            type: "increase",
            nextWeight,
            text: `Hit target! Suggest +${increment}kg progression (${currentWeight}kg → ${nextWeight}kg)`
          };
        } else if (plateauStatus.isPlateaued && !isInjuryRisk) {
          progressionSuggestion = {
            type: "plateau",
            text: `Plateau detected (${plateauStatus.sessionsFlat} flat sessions). Keep target at ${currentWeight}kg or alter reps/variation.`
          };
        } else if (isInjuryRisk) {
          progressionSuggestion = {
            type: "injury_risk",
            text: `Injury risk flagged (${injuryRisk.level}: ${injuryRisk.reason}). Keep target at ${currentWeight}kg or reduce to prevent strain.`
          };
        }
      }

      return {
        ...ex,
        loggedSets,
        setsMeetingTarget,
        isFullyComplete,
        progressionSuggestion
      };
    });
  }, [todayProgramDay, rawLogs, todayStr]);

  // Set Active Program
  const handleSetActive = async (programId) => {
    try {
      setIsSaving(true);
      // Deactivate all programs
      const { error: errorDeactivate } = await supabase
        .from('training_programs')
        .update({ is_active: false })
        .neq('id', programId);
      if (errorDeactivate) throw errorDeactivate;

      // Activate target program
      const { error: errorActivate } = await supabase
        .from('training_programs')
        .update({ is_active: true })
        .eq('id', programId);
      if (errorActivate) throw errorActivate;

      onRefresh();
    } catch (err) {
      console.error("Failed to set active program:", err);
      alert("Error setting program active: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Accept Progression Suggestion
  const handleAcceptProgression = async (exerciseId, nextWeight) => {
    try {
      setIsUpdatingProgression(true);
      const { error } = await supabase
        .from('program_exercises')
        .update({ target_weight_kg: nextWeight })
        .eq('id', exerciseId);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error("Failed to update target weight progression:", err);
      alert("Error saving target weight: " + err.message);
    } finally {
      setIsUpdatingProgression(false);
    }
  };

  // Dismiss Progression Suggestion
  const handleDismissSuggestion = (exerciseId) => {
    setDismissedSuggestions(prev => {
      const next = new Set(prev);
      next.add(exerciseId);
      return next;
    });
  };

  // Delete Program
  const handleDeleteProgram = async (programId) => {
    if (!confirm("Are you sure you want to delete this program? All days and exercises will be deleted.")) return;
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('training_programs')
        .delete()
        .eq('id', programId);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error("Failed to delete program:", err);
      alert("Error deleting program: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Add Day to Program Builder Form
  const handleAddDay = () => {
    setDays(prev => [
      ...prev,
      {
        id: "temp-" + Date.now() + Math.random(),
        name: `Day ${prev.length + 1}`,
        weekday: scheduleType === "fixed_days" ? "Mon" : null,
        day_order: scheduleType === "rotating_cycle" ? prev.length + 1 : null,
        exercises: []
      }
    ]);
  };

  // Remove Day from Program Builder Form
  const handleRemoveDay = (dayId) => {
    setDays(prev => prev.filter(d => d.id !== dayId));
  };

  // Add Exercise to Program Day
  const handleAddExercise = (dayId) => {
    setDays(prev => prev.map(day => {
      if (day.id !== dayId) return day;
      return {
        ...day,
        exercises: [
          ...day.exercises,
          {
            id: "temp-ex-" + Date.now() + Math.random(),
            exercise_title: exercisesList.length ? exercisesList[0].title : "",
            target_sets: 3,
            target_reps: 10,
            target_weight_kg: ""
          }
        ]
      };
    }));
  };

  // Remove Exercise from Program Day
  const handleRemoveExercise = (dayId, exId) => {
    setDays(prev => prev.map(day => {
      if (day.id !== dayId) return day;
      return {
        ...day,
        exercises: day.exercises.filter(ex => ex.id !== exId)
      };
    }));
  };

  // Edit Program Loader
  const handleEditProgramStart = (prog) => {
    setEditingProgramId(prog.id);
    setProgramName(prog.name);
    setScheduleType(prog.schedule_type);
    
    // Map existing days structure
    const mappedDays = prog.days.map(d => ({
      id: d.id,
      name: d.name,
      weekday: d.weekday,
      day_order: d.day_order,
      exercises: d.exercises.map(e => ({
        id: e.id,
        exercise_title: e.exercise_title,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        target_weight_kg: e.target_weight_kg || ""
      }))
    }));
    setDays(mappedDays);
    setShowForm(true);
    setFormError("");
  };

  // Reset Builder Form
  const handleResetForm = () => {
    setEditingProgramId(null);
    setProgramName("");
    setScheduleType("fixed_days");
    setDays([]);
    setShowForm(false);
    setFormError("");
  };

  // Save Program (New or Updated)
  const handleSaveProgramSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!programName.trim()) {
      setFormError("Program name is required.");
      return;
    }
    if (days.length === 0) {
      setFormError("You must add at least one training day.");
      return;
    }

    // Validation for Fixed Days duplicate weekdays
    if (scheduleType === "fixed_days") {
      const weekdays = days.map(d => d.weekday);
      const uniqueWeekdays = [...new Set(weekdays)];
      if (weekdays.length !== uniqueWeekdays.length) {
        setFormError("Each weekday (Mon-Sun) can only be assigned once within a program.");
        return;
      }
    }

    try {
      setIsSaving(true);
      let programId = editingProgramId;

      // 1. Save or Update training_programs
      if (editingProgramId) {
        const { error } = await supabase
          .from('training_programs')
          .update({ name: programName, schedule_type: scheduleType })
          .eq('id', editingProgramId);
        if (error) throw error;
        
        // cascade deletes all previous days to allow fresh rewrite
        const { error: deleteError } = await supabase
          .from('program_days')
          .delete()
          .eq('program_id', editingProgramId);
        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase
          .from('training_programs')
          .insert({ name: programName, schedule_type: scheduleType, is_active: false })
          .select()
          .single();
        if (error) throw error;
        programId = data.id;
      }

      // 2. Insert new days and exercises in series to retain IDs correctly
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const dayPayload = {
          program_id: programId,
          name: day.name,
          weekday: scheduleType === "fixed_days" ? day.weekday : null,
          day_order: scheduleType === "rotating_cycle" ? (i + 1) : null
        };
        const { data: insertedDay, error: dayError } = await supabase
          .from('program_days')
          .insert(dayPayload)
          .select()
          .single();
        if (dayError) throw dayError;

        // Insert exercises for this day
        if (day.exercises && day.exercises.length) {
          const exercisesPayload = day.exercises.map((ex, exIdx) => ({
            day_id: insertedDay.id,
            exercise_title: ex.exercise_title,
            target_sets: Number(ex.target_sets),
            target_reps: Number(ex.target_reps),
            target_weight_kg: ex.target_weight_kg ? Number(ex.target_weight_kg) : null,
            sort_order: exIdx
          }));
          const { error: exercisesError } = await supabase
            .from('program_exercises')
            .insert(exercisesPayload);
          if (exercisesError) throw exercisesError;
        }
      }

      handleResetForm();
      onRefresh();
    } catch (err) {
      console.error("Failed to save program:", err);
      setFormError("Error saving program: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reorder Exercises inside builder
  const moveExercise = (dayId, fromIndex, toIndex) => {
    setDays(prev => prev.map(day => {
      if (day.id !== dayId) return day;
      const updatedExercises = [...day.exercises];
      const [moved] = updatedExercises.splice(fromIndex, 1);
      updatedExercises.splice(toIndex, 0, moved);
      return {
        ...day,
        exercises: updatedExercises
      };
    }));
  };

  // Reorder Days inside rotating builder
  const moveDay = (fromIndex, toIndex) => {
    setDays(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((d, idx) => ({
        ...d,
        day_order: scheduleType === "rotating_cycle" ? idx + 1 : null
      }));
    });
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: TODAY'S GUIDANCE SESSION */}
      <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="text-[#F4B740]" size={20} />
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: "'Oswald', sans-serif" }}>
              Today's Session Guidance
            </h2>
          </div>
          {activeProgram && (
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#F4B740]/10 border border-[#F4B740]/30 text-[#F4B740]">
              Active: {activeProgram.name}
            </span>
          )}
        </div>

        {!activeProgram ? (
          <div className="bg-[#0C0E12] rounded-lg border border-[#232830] p-6 text-center text-xs text-[#8A919C] space-y-3">
            <Clipboard size={24} className="mx-auto text-[#8A919C]/60" />
            <p>No active training program found.</p>
            <p className="text-[10px]">Select a program template from the library below and click "Set Active" to load training guidance.</p>
          </div>
        ) : !todayProgramDay ? (
          <div className="bg-[#0C0E12] rounded-lg border border-[#232830] p-6 text-center text-xs text-[#8A919C] space-y-2">
            <Clock size={24} className="mx-auto text-[#8A919C]/60" />
            <p className="font-semibold text-emerald-400">Rest Day ({todayWeekday})</p>
            <p className="text-[10px]">No workouts are scheduled for today in your active program. Enjoy your physical recovery!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-b border-[#232830] pb-2 flex justify-between items-baseline">
              <span className="text-xs font-semibold text-[#E7E9EC]">
                {todayProgramDay.name} {activeProgram.schedule_type === "fixed_days" ? `(${todayProgramDay.weekday})` : ""}
              </span>
              <span className="text-[10px] text-[#8A919C] font-mono">
                Date: {todayStr}
              </span>
            </div>

            {/* List Exercises */}
            <div className="space-y-3">
              {todayExercisesStatus.map((ex, index) => {
                const isDismissed = dismissedSuggestions.has(ex.id);
                return (
                  <div key={ex.id} className="bg-[#0C0E12] rounded-lg border border-[#232830] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-[#232830] text-[#8A919C] font-mono text-[10px] flex items-center justify-center font-bold">
                            {index + 1}
                          </span>
                          <span className="text-xs font-semibold text-[#E7E9EC]">{ex.exercise_title}</span>
                        </div>
                        <div className="text-[10px] text-[#8A919C] flex items-center gap-3 font-mono">
                          <span>Target: <span className="text-[#E7E9EC]">{ex.target_sets}s x {ex.target_reps}r</span></span>
                          {ex.target_weight_kg && (
                            <span>Weight: <span className="text-[#E7E9EC]">{ex.target_weight_kg} kg</span></span>
                          )}
                        </div>
                      </div>

                      {/* Completion status indicator */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[10px] font-mono block text-[#8A919C]">
                            Logged: <span className={ex.loggedSets >= ex.target_sets ? "text-emerald-400 font-bold" : "text-[#E7E9EC]"}>{ex.loggedSets}</span> / {ex.target_sets} sets
                          </span>
                          {ex.loggedSets > 0 && (
                            <span className="text-[9px] font-mono block text-[#8A919C]">
                              {ex.setsMeetingTarget} met reps/weight
                            </span>
                          )}
                        </div>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                          ex.isFullyComplete
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                            : "bg-[#232830]/30 border-[#232830] text-[#8A919C]"
                        }`}>
                          {ex.isFullyComplete ? <CheckCircle2 size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-[#8A919C]/40" />}
                        </div>
                      </div>
                    </div>

                    {/* Progression Alert block */}
                    {ex.progressionSuggestion && !isDismissed && (
                      <div className="rounded-lg border bg-[#1B1F26] p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all border-[#F4B740]/25 bg-[#F4B740]/5">
                        <div className="flex items-start gap-2 text-xs">
                          {ex.progressionSuggestion.type === "increase" ? (
                            <Award className="text-[#F4B740] shrink-0 mt-0.5" size={14} />
                          ) : (
                            <Info className="text-[#8A919C] shrink-0 mt-0.5" size={14} />
                          )}
                          <div className="text-[11px] text-[#8A919C] leading-normal">
                            <span className="font-semibold block text-[#E7E9EC] uppercase tracking-wider text-[9px] mb-0.5">
                              {ex.progressionSuggestion.type === "increase" ? "Progression Ready" : "Progression Alert"}
                            </span>
                            {ex.progressionSuggestion.text}
                          </div>
                        </div>

                        {ex.progressionSuggestion.type === "increase" && (
                          <div className="flex gap-2 self-end md:self-center shrink-0">
                            <button
                              disabled={isUpdatingProgression}
                              onClick={() => handleAcceptProgression(ex.id, ex.progressionSuggestion.nextWeight)}
                              className="px-2.5 py-1 text-[10px] bg-[#F4B740] text-[#0C0E12] font-bold rounded hover:opacity-90 transition-opacity flex items-center gap-1"
                            >
                              {isUpdatingProgression ? (
                                <RefreshCw className="animate-spin" size={10} />
                              ) : (
                                <Check size={10} />
                              )}
                              Accept
                            </button>
                            <button
                              onClick={() => handleDismissSuggestion(ex.id)}
                              className="px-2.5 py-1 text-[10px] bg-[#232830] text-[#8A919C] font-semibold rounded hover:text-[#E7E9EC] transition-all flex items-center gap-1"
                            >
                              <X size={10} />
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: BUILDER FLOW */}
      {showForm && (
        <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#232830] pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Settings size={15} color="#F4B740" />
              {editingProgramId ? "Edit Training Program Template" : "Create New Program Template"}
            </h3>
            <button onClick={handleResetForm} className="text-[#8A919C] hover:text-[#E7E9EC]">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSaveProgramSubmit} className="space-y-4 text-xs">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#8A919C] font-semibold">Program Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5/3/1 Powerlifting, Push/Pull/Legs"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="w-full bg-[#0C0E12] border border-[#232830] rounded-lg px-3 py-2 text-xs text-[#E7E9EC] focus:outline-none focus:border-[#F4B740]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[#8A919C] font-semibold">Schedule Structure</label>
                <select
                  disabled={!!editingProgramId}
                  value={scheduleType}
                  onChange={(e) => {
                    setScheduleType(e.target.value);
                    setDays([]);
                  }}
                  className="w-full bg-[#0C0E12] border border-[#232830] rounded-lg px-3 py-2 text-xs text-[#E7E9EC] focus:outline-none focus:border-[#F4B740]"
                >
                  <option value="fixed_days">Fixed Weekly Days (Mon-Sun calendar)</option>
                  <option value="rotating_cycle">Rotating Cycle (Sequential Days order)</option>
                </select>
              </div>
            </div>

            {/* Days Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-[#8A919C] font-semibold">Training Days List</span>
                <button
                  type="button"
                  onClick={handleAddDay}
                  className="flex items-center gap-1 text-[10px] text-[#F4B740] hover:opacity-80 transition-all font-semibold"
                >
                  <Plus size={12} /> Add Day
                </button>
              </div>

              {days.length === 0 ? (
                <div className="border border-dashed border-[#232830] rounded-lg p-6 text-center text-xs text-[#8A919C]">
                  No training days added. Click "Add Day" above to configure your template workouts.
                </div>
              ) : (
                <div className="space-y-4">
                  {days.map((day, dayIdx) => (
                    <div key={day.id} className="bg-[#0C0E12] rounded-lg border border-[#232830] p-4 space-y-3 relative">
                      {/* Day Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232830]/50 pb-2">
                        <div className="flex items-center gap-2">
                          {scheduleType === "rotating_cycle" && (
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={dayIdx === 0}
                                onClick={() => moveDay(dayIdx, dayIdx - 1)}
                                className="text-[#8A919C] hover:text-[#E7E9EC] disabled:opacity-30"
                              >
                                <ChevronUp size={10} />
                              </button>
                              <button
                                type="button"
                                disabled={dayIdx === days.length - 1}
                                onClick={() => moveDay(dayIdx, dayIdx + 1)}
                                className="text-[#8A919C] hover:text-[#E7E9EC] disabled:opacity-30"
                              >
                                <ChevronDown size={10} />
                              </button>
                            </div>
                          )}
                          <input
                            type="text"
                            required
                            placeholder="Day Title (e.g. Lower Body, Bench Day)"
                            value={day.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDays(prev => prev.map(d => d.id === day.id ? { ...d, name: val } : d));
                            }}
                            className="bg-transparent border-b border-[#232830] focus:border-[#F4B740] focus:outline-none font-semibold text-xs text-[#E7E9EC]"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          {scheduleType === "fixed_days" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[#8A919C] uppercase font-semibold">Weekday:</span>
                              <select
                                value={day.weekday || "Mon"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDays(prev => prev.map(d => d.id === day.id ? { ...d, weekday: val } : d));
                                }}
                                className="bg-[#15181D] border border-[#232830] rounded px-2 py-0.5 text-xs text-[#E7E9EC] focus:outline-none"
                              >
                                <option value="Mon">Mon</option>
                                <option value="Tue">Tue</option>
                                <option value="Wed">Wed</option>
                                <option value="Thu">Thu</option>
                                <option value="Fri">Fri</option>
                                <option value="Sat">Sat</option>
                                <option value="Sun">Sun</option>
                              </select>
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-[#8A919C]">Day Order: #{dayIdx + 1}</span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveDay(day.id)}
                            className="text-[#EF7B57] hover:opacity-85 transition-all p-1 bg-[#EF7B57]/10 rounded border border-[#EF7B57]/20"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Exercises under this Day */}
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-[#8A919C] uppercase tracking-wider">Exercises</span>
                          <button
                            type="button"
                            onClick={() => handleAddExercise(day.id)}
                            className="flex items-center gap-1 text-[10px] text-[#F4B740] hover:opacity-80 transition-all font-semibold"
                          >
                            <Plus size={10} /> Add Exercise
                          </button>
                        </div>

                        {day.exercises.length === 0 ? (
                          <div className="border border-dashed border-[#232830]/50 rounded p-4 text-center text-[10px] text-[#8A919C]">
                            No exercises added yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {day.exercises.map((ex, exIdx) => (
                              <div key={ex.id} className="grid grid-cols-12 gap-2 bg-[#15181D] border border-[#232830]/50 rounded p-2.5 items-center">
                                {/* Sort arrows */}
                                <div className="col-span-1 flex flex-col items-center">
                                  <button
                                    type="button"
                                    disabled={exIdx === 0}
                                    onClick={() => moveExercise(day.id, exIdx, exIdx - 1)}
                                    className="text-[#8A919C] hover:text-[#E7E9EC] disabled:opacity-30"
                                  >
                                    <ChevronUp size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={exIdx === day.exercises.length - 1}
                                    onClick={() => moveExercise(day.id, exIdx, exIdx + 1)}
                                    className="text-[#8A919C] hover:text-[#E7E9EC] disabled:opacity-30"
                                  >
                                    <ChevronDown size={10} />
                                  </button>
                                </div>

                                {/* Title selection */}
                                <div className="col-span-4 space-y-0.5">
                                  <label className="text-[8px] text-[#8A919C] uppercase font-bold block">Exercise Title</label>
                                  <select
                                    value={ex.exercise_title}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setDays(prev => prev.map(d => {
                                        if (d.id !== day.id) return d;
                                        return {
                                          ...d,
                                          exercises: d.exercises.map(eItem => eItem.id === ex.id ? { ...eItem, exercise_title: val } : eItem)
                                        };
                                      }));
                                    }}
                                    className="w-full bg-[#0C0E12] border border-[#232830] rounded px-2 py-1 text-xs text-[#E7E9EC] focus:outline-none"
                                  >
                                    {exercisesList.map(eOpt => (
                                      <option key={eOpt.work_id} value={eOpt.title}>{eOpt.title}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Target sets */}
                                <div className="col-span-2 space-y-0.5">
                                  <label className="text-[8px] text-[#8A919C] uppercase font-bold block">Sets</label>
                                  <input
                                    type="number"
                                    min="1"
                                    required
                                    value={ex.target_sets}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setDays(prev => prev.map(d => {
                                        if (d.id !== day.id) return d;
                                        return {
                                          ...d,
                                          exercises: d.exercises.map(eItem => eItem.id === ex.id ? { ...eItem, target_sets: val } : eItem)
                                        };
                                      }));
                                    }}
                                    className="w-full bg-[#0C0E12] border border-[#232830] rounded px-2 py-1 text-xs text-[#E7E9EC] text-right focus:outline-none"
                                  />
                                </div>

                                {/* Target reps */}
                                <div className="col-span-2 space-y-0.5">
                                  <label className="text-[8px] text-[#8A919C] uppercase font-bold block">Reps</label>
                                  <input
                                    type="number"
                                    min="1"
                                    required
                                    value={ex.target_reps}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setDays(prev => prev.map(d => {
                                        if (d.id !== day.id) return d;
                                        return {
                                          ...d,
                                          exercises: d.exercises.map(eItem => eItem.id === ex.id ? { ...eItem, target_reps: val } : eItem)
                                        };
                                      }));
                                    }}
                                    className="w-full bg-[#0C0E12] border border-[#232830] rounded px-2 py-1 text-xs text-[#E7E9EC] text-right focus:outline-none"
                                  />
                                </div>

                                {/* Target weight */}
                                <div className="col-span-2 space-y-0.5">
                                  <label className="text-[8px] text-[#8A919C] uppercase font-bold block">Weight (kg)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Optional"
                                    value={ex.target_weight_kg}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setDays(prev => prev.map(d => {
                                        if (d.id !== day.id) return d;
                                        return {
                                          ...d,
                                          exercises: d.exercises.map(eItem => eItem.id === ex.id ? { ...eItem, target_weight_kg: val } : eItem)
                                        };
                                      }));
                                    }}
                                    className="w-full bg-[#0C0E12] border border-[#232830] rounded px-2 py-1 text-xs text-[#E7E9EC] text-right focus:outline-none"
                                  />
                                </div>

                                {/* Delete exercise */}
                                <div className="col-span-1 text-right pt-2.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExercise(day.id, ex.id)}
                                    className="text-[#EF7B57] hover:opacity-80 transition-all"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formError && <p className="text-red-400 text-xs font-semibold">{formError}</p>}

            <div className="flex justify-end gap-3 pt-3 border-t border-[#232830]">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 bg-[#232830] text-[#E7E9EC] rounded-lg font-semibold hover:bg-[#3A414C] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-[#F4B740] text-[#0C0E12] font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                {isSaving && <RefreshCw size={12} className="animate-spin" />}
                {editingProgramId ? "Save Changes" : "Create Program"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 3: PROGRAM TEMPLATES LIBRARY */}
      <div className="rounded-xl border border-[#232830] bg-[#15181D] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clipboard className="text-[#F4B740]" size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: "'Oswald', sans-serif" }}>
              Program Templates Library
            </h2>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                setEditingProgramId(null);
                setProgramName("");
                setScheduleType("fixed_days");
                setDays([]);
                setShowForm(true);
                setFormError("");
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#F4B740] text-[#0C0E12] text-xs font-bold hover:opacity-90 transition-all"
            >
              <Plus size={13} /> New Program
            </button>
          )}
        </div>

        {programsWithDays.length === 0 ? (
          <div className="bg-[#0C0E12] rounded-lg border border-[#232830] p-6 text-center text-xs text-[#8A919C]">
            No training programs saved. Click "New Program" to build your first routine structure.
          </div>
        ) : (
          <div className="grid gap-4">
            {programsWithDays.map((prog) => (
              <div
                key={prog.id}
                className={`bg-[#0C0E12] rounded-lg border p-4 space-y-3 transition-all ${
                  prog.is_active
                    ? "border-[#F4B740] bg-[#F4B740]/5"
                    : "border-[#232830] hover:border-[#3A414C]"
                }`}
              >
                {/* Library Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#E7E9EC]">{prog.name}</span>
                      {prog.is_active && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          Active Guide
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#8A919C] uppercase font-mono tracking-wider flex items-center gap-2">
                      <span>Type: {prog.schedule_type === "fixed_days" ? "Fixed Weekly Days" : "Rotating Cycle"}</span>
                      <span>•</span>
                      <span>{prog.days?.length || 0} Training Days</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!prog.is_active ? (
                      <button
                        onClick={() => handleSetActive(prog.id)}
                        disabled={isSaving}
                        className="px-2.5 py-1.5 rounded bg-[#1B1F26] border border-[#232830] hover:border-[#F4B740] hover:text-[#F4B740] text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        <Play size={10} /> Set Active
                      </button>
                    ) : (
                      <div className="px-2.5 py-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1">
                        <Check size={10} /> Active
                      </div>
                    )}
                    <button
                      onClick={() => handleEditProgramStart(prog)}
                      className="text-[#8A919C] hover:text-[#E7E9EC] p-1.5 bg-[#232830]/30 rounded border border-[#232830] transition-colors"
                      title="Edit template"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(prog.id)}
                      disabled={isSaving}
                      className="text-[#EF7B57] hover:bg-[#EF7B57]/10 p-1.5 bg-[#EF7B57]/5 rounded border border-[#EF7B57]/20 transition-all"
                      title="Delete template"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Day Previews */}
                {prog.days && prog.days.length > 0 && (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    {prog.days.map((day) => (
                      <div key={day.id} className="bg-[#15181D] rounded border border-[#232830]/40 p-2.5 space-y-1.5">
                        <div className="flex justify-between items-baseline border-b border-[#232830]/50 pb-1">
                          <span className="text-[10px] font-semibold text-[#E7E9EC] truncate max-w-[80px]">{day.name}</span>
                          {prog.schedule_type === "fixed_days" ? (
                            <span className="text-[8px] uppercase tracking-wider text-[#F4B740] font-bold font-mono">{day.weekday}</span>
                          ) : (
                            <span className="text-[8px] text-[#8A919C] font-mono">Day {day.day_order}</span>
                          )}
                        </div>
                        <ul className="space-y-1 text-[10px] text-[#8A919C] list-inside list-disc">
                          {(day.exercises || []).map((ex) => (
                            <li key={ex.id} className="truncate">
                              {ex.exercise_title} ({ex.target_sets}x{ex.target_reps})
                            </li>
                          ))}
                          {(day.exercises || []).length === 0 && (
                            <span className="text-[9px] italic block text-[#8A919C]/60">Empty workout</span>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
