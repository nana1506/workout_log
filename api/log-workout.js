// api/log-workout.js
// Vercel serverless function — fetches workout details from Hevy API and inserts flattened rows into Supabase workout_log.
// Endpoint: POST /api/log-workout or GET /api/log-workout?workoutId=...

import { createClient } from "@supabase/supabase-js";
import { extractWorkoutId, flattenHevyWorkout } from "../src/utils/hevySync.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use POST or GET." });
  }

  const rawWorkoutId = req.body?.workoutId || req.body?.workout_id || req.query?.workoutId || req.query?.workout_id;
  const workoutId = extractWorkoutId(rawWorkoutId);

  if (!workoutId) {
    return res.status(400).json({
      error: "Missing required field: workoutId (or URL). Please provide a valid Hevy workout ID or share link."
    });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Supabase credentials not configured in environment" });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const hevyApiUrl = `https://api.hevyapp.com/workout/${encodeURIComponent(workoutId)}`;
    
    const hevyResponse = await fetch(hevyApiUrl, {
      method: "GET",
      headers: {
        "Origin": "https://hevy.com",
        "Referer": "https://hevy.com",
        "X-Api-Key": "shelobs_hevy_web",
        "Accept": "application/json, text/plain, */*"
      }
    });

    if (!hevyResponse.ok) {
      if (hevyResponse.status === 404) {
        return res.status(404).json({
          error: `Workout "${workoutId}" not found on Hevy. Please check the Workout ID or URL and ensure the workout is public.`
        });
      }
      const errText = await hevyResponse.text().catch(() => "");
      return res.status(hevyResponse.status).json({
        error: `Hevy API responded with error code ${hevyResponse.status}`,
        details: errText
      });
    }

    const hevyData = await hevyResponse.json();
    const flattened = flattenHevyWorkout(hevyData, workoutId);

    if (!flattened.rows || flattened.rows.length === 0) {
      return res.status(400).json({
        error: "Workout contains 0 sets or exercises to log."
      });
    }

    const { data: insertedData, error: insertError } = await supabase
      .from("workout_log")
      .insert(flattened.rows)
      .select();

    if (insertError) {
      console.error("Supabase insert error in log-workout:", insertError);
      return res.status(500).json({
        error: "Failed to insert workout logs into database",
        details: insertError.message || insertError
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully logged workout "${flattened.workout_title}" (${flattened.rows.length} sets across ${flattened.exercises_summary.length} exercises)`,
      workout_id: flattened.workout_id,
      workout_title: flattened.workout_title,
      count: flattened.rows.length,
      exercises_count: flattened.exercises_summary.length,
      exercises_summary: flattened.exercises_summary,
      rows: insertedData || flattened.rows
    });
  } catch (err) {
    console.error("log-workout unexpected error:", err);
    return res.status(500).json({
      error: "Internal server error while logging workout",
      details: err.message || String(err)
    });
  }
}
