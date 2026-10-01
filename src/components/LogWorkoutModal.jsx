import React, { useState, useEffect } from "react";
import {
  X,
  Dumbbell,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Clipboard,
  ExternalLink,
  Layers,
  Sparkles,
  Database,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck
} from "lucide-react";
import { extractWorkoutId, flattenHevyWorkout } from "../utils/hevySync";
import { supabase } from "../App";

const DEFAULT_PIN = "476267";

export default function LogWorkoutModal({ isOpen, onClose, onWorkoutLogged }) {
  const [workoutInput, setWorkoutInput] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("idle"); // 'idle' | 'fetching' | 'parsing' | 'inserting' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState("");
  const [resultData, setResultData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setStep("idle");
      setErrorMsg("");
      setResultData(null);
      setPin("");
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setWorkoutInput(text.trim());
      }
    } catch (err) {
      console.warn("Clipboard access denied or unavailable", err);
    }
  };

  const handleLogWorkout = async (e) => {
    e?.preventDefault();
    const cleanId = extractWorkoutId(workoutInput);
    const enteredPin = pin.trim();

    if (!cleanId) {
      setErrorMsg("Please enter a valid Hevy Workout ID or workout URL.");
      return;
    }

    if (!enteredPin) {
      setErrorMsg("Please enter your security PIN to log this workout.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setStep("fetching");

    try {
      // Step 1: Attempt via serverless API route (/api/log-workout)
      let apiSucceeded = false;
      let responsePayload = null;

      try {
        const res = await fetch("/api/log-workout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Workout-Pin": enteredPin,
            "X-Pin": enteredPin,
          },
          body: JSON.stringify({ workoutId: cleanId, pin: enteredPin }),
        });

        if (res.ok) {
          responsePayload = await res.json();
          apiSucceeded = true;
        } else {
          const errJson = await res.json().catch(() => null);
          const message = errJson?.error || `API returned status ${res.status}`;
          if (res.status === 401) {
            throw new Error("Invalid security PIN. Access denied.");
          }
          if (res.status === 404 || res.status === 400 || res.status === 500) {
            throw new Error(message);
          }
        }
      } catch (apiErr) {
        if (apiErr.message && !apiErr.message.includes("Failed to fetch") && !apiErr.message.includes("404")) {
          throw apiErr;
        }
        console.warn("Direct API route unavailable or failed, falling back to client-assisted flow:", apiErr);
      }

      // Step 2 (Fallback if API endpoint couldn't process): Client-assisted flow with client PIN verification
      if (!apiSucceeded || !responsePayload) {
        const validPin = import.meta.env.VITE_WORKOUT_LOG_PIN || DEFAULT_PIN;
        if (enteredPin !== validPin) {
          throw new Error("Invalid security PIN. Access denied.");
        }

        setStep("fetching");
        const hevyRes = await fetch(`https://api.hevyapp.com/workout/${encodeURIComponent(cleanId)}`, {
          headers: {
            "Origin": "https://hevy.com",
            "Referer": "https://hevy.com",
            "X-Api-Key": "shelobs_hevy_web",
            "Accept": "application/json, text/plain, */*"
          }
        });

        if (!hevyRes.ok) {
          if (hevyRes.status === 404) {
            throw new Error(`Workout "${cleanId}" not found on Hevy. Please verify the ID or URL.`);
          }
          throw new Error(`Hevy API returned status ${hevyRes.status}`);
        }

        setStep("parsing");
        const hevyJson = await hevyRes.json();
        const flattened = flattenHevyWorkout(hevyJson, cleanId);

        if (!flattened.rows || flattened.rows.length === 0) {
          throw new Error("Workout contains 0 exercises or sets.");
        }

        setStep("inserting");
        const { data: insertedData, error: dbError } = await supabase
          .from("workout_log")
          .insert(flattened.rows)
          .select();

        if (dbError) {
          throw new Error(`Supabase Insert Error: ${dbError.message || dbError}`);
        }

        responsePayload = {
          success: true,
          workout_id: flattened.workout_id,
          workout_title: flattened.workout_title,
          count: flattened.rows.length,
          exercises_count: flattened.exercises_summary.length,
          exercises_summary: flattened.exercises_summary,
          rows: insertedData || flattened.rows
        };
      }

      setResultData(responsePayload);
      setStep("success");
      if (onWorkoutLogged) {
        onWorkoutLogged(responsePayload);
      }
    } catch (err) {
      console.error("Failed to log workout:", err);
      setErrorMsg(err.message || "An unexpected error occurred while logging the workout.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setWorkoutInput("");
    setPin("");
    setStep("idle");
    setErrorMsg("");
    setResultData(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-lg bg-[#15181D] border border-[#232830] rounded-2xl shadow-2xl overflow-hidden text-[#E7E9EC] transition-all"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#232830] bg-[#121418]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F4B740]/15 border border-[#F4B740]/30 flex items-center justify-center">
              <Dumbbell size={18} color="#F4B740" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  LOG WORKOUT FROM HEVY
                </h2>
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#F4B740]/10 border border-[#F4B740]/25 text-[#F4B740] font-medium">
                  <ShieldCheck size={11} /> PIN Protected
                </span>
              </div>
              <p className="text-xs text-[#8A919C]">
                Import session and sync sets into Supabase <code className="text-[#F4B740] font-mono">workout_log</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-[#8A919C] hover:text-[#E7E9EC] hover:bg-[#232830] transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Step: Success View */}
          {step === "success" && resultData ? (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-400">Workout Successfully Logged!</p>
                  <p className="text-xs text-[#A1A7B2]">
                    Inserted <strong className="text-[#E7E9EC]">{resultData.count || resultData.rows?.length || 0} sets</strong> into your database.
                  </p>
                </div>
              </div>

              {/* Workout Details Card */}
              <div className="p-4 rounded-xl border border-[#232830] bg-[#1B1F26] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#F4B740]">{resultData.workout_title || "Workout"}</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#232830] text-[#8A919C]">
                    ID: {resultData.workout_id}
                  </span>
                </div>

                {/* Exercises Summary breakdown */}
                {resultData.exercises_summary && resultData.exercises_summary.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[#232830]/80">
                    <p className="text-[11px] font-medium text-[#8A919C] uppercase tracking-wider">
                      Logged Exercises ({resultData.exercises_summary.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {resultData.exercises_summary.map((ex, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#15181D] border border-[#232830]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[#8A919C] font-mono text-[10px]">{idx + 1}.</span>
                            <span className="font-medium text-[#E7E9EC]">{ex.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {ex.muscle_group && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#232830] text-[#8A919C]">
                                {ex.muscle_group}
                              </span>
                            )}
                            <span className="text-[11px] font-mono font-medium text-[#F4B740]">
                              {ex.sets_count} {ex.sets_count === 1 ? "set" : "sets"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-[#232830] bg-[#1B1F26] hover:bg-[#232830] text-xs font-semibold text-[#E7E9EC] transition-all flex items-center justify-center gap-1.5"
                >
                  <PlusCircle size={14} /> Log Another Workout
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#F4B740] hover:bg-[#F4B740]/90 text-[#0C0E12] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#F4B740]/10"
                >
                  Done &amp; View Dashboard <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* Step: Idle / Fetching / Error Form */
            <form onSubmit={handleLogWorkout} className="space-y-4">
              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400 animate-fade-in">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Unable to Log Workout</p>
                    <p className="text-[11px] text-red-400/90 leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Workout ID Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#E7E9EC] flex items-center gap-1.5">
                    <span>Hevy Workout ID / URL</span>
                    <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="text-[11px] text-[#F4B740] hover:underline flex items-center gap-1 transition-colors"
                  >
                    <Clipboard size={11} /> Paste Link
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={workoutInput}
                    onChange={(e) => setWorkoutInput(e.target.value)}
                    placeholder="e.g. gR9V1s3a or https://hevy.com/workout/gR9V1s3a"
                    disabled={loading}
                    className="w-full bg-[#1B1F26] border border-[#232830] focus:border-[#F4B740] focus:ring-1 focus:ring-[#F4B740] rounded-xl px-3.5 py-2.5 text-xs text-[#E7E9EC] placeholder-[#555C68] outline-none font-mono transition-all"
                  />
                  {workoutInput && !loading && (
                    <button
                      type="button"
                      onClick={() => setWorkoutInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A919C] hover:text-[#E7E9EC]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[#8A919C]">
                  Accepts direct workout IDs (UUID or short ID) or full Hevy share URLs.
                </p>
              </div>

              {/* PIN Code Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#E7E9EC] flex items-center gap-1.5">
                    <Lock size={12} className="text-[#F4B740]" />
                    <span>Security PIN</span>
                    <span className="text-red-400">*</span>
                  </label>
                  <span className="text-[10px] text-[#8A919C]">
                    Default PIN: <strong className="text-[#E7E9EC] font-mono">476267</strong>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter 6-digit PIN"
                    maxLength={10}
                    disabled={loading}
                    autoComplete="off"
                    className="w-full bg-[#1B1F26] border border-[#232830] focus:border-[#F4B740] focus:ring-1 focus:ring-[#F4B740] rounded-xl px-3.5 py-2.5 text-xs text-[#E7E9EC] placeholder-[#555C68] outline-none font-mono tracking-widest transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A919C] hover:text-[#E7E9EC] transition-colors"
                  >
                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Progress Stepper (Visible during loading) */}
              {loading && (
                <div className="p-3.5 rounded-xl border border-[#232830] bg-[#1B1F26] space-y-2.5 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#F4B740]">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verifying PIN &amp; processing workout data...</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${step === "fetching" ? "bg-[#F4B740] animate-ping" : "bg-emerald-400"}`} />
                      <span className={step === "fetching" ? "text-[#E7E9EC] font-medium" : "text-[#8A919C]"}>
                        1. Fetching workout from Hevy API (api.hevyapp.com)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${step === "parsing" ? "bg-[#F4B740] animate-ping" : step === "inserting" || step === "success" ? "bg-emerald-400" : "bg-[#232830]"}`} />
                      <span className={step === "parsing" ? "text-[#E7E9EC] font-medium" : "text-[#8A919C]"}>
                        2. Flattening exercises, sets, RPE &amp; PR records
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${step === "inserting" ? "bg-[#F4B740] animate-ping" : step === "success" ? "bg-emerald-400" : "bg-[#232830]"}`} />
                      <span className={step === "inserting" ? "text-[#E7E9EC] font-medium" : "text-[#8A919C]"}>
                        3. Inserting into Supabase <code className="text-[#F4B740]">workout_log</code>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Information pill */}
              <div className="p-3 rounded-xl bg-[#121418] border border-[#232830] flex items-start gap-2.5 text-[11px] text-[#8A919C]">
                <Database size={14} className="text-[#F4B740] shrink-0 mt-0.5" />
                <span>
                  Flattened set records will automatically sync with volume tonnage, 1RM estimations, fatigue curves, and AI coaching.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="w-1/3 py-2.5 px-3 rounded-xl border border-[#232830] bg-[#1B1F26] hover:bg-[#232830] text-xs font-semibold text-[#8A919C] hover:text-[#E7E9EC] transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !workoutInput.trim() || !pin.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#F4B740] hover:bg-[#F4B740]/90 disabled:bg-[#F4B740]/40 text-[#0C0E12] disabled:text-[#0C0E12]/50 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#F4B740]/10 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Logging Workout...
                    </>
                  ) : (
                    <>
                      <PlusCircle size={15} />
                      Verify &amp; Log Workout
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
