// api/send-progress-newsletter.js
// Vercel serverless function — automated cron-triggered progress newsletter sender.
// Endpoint: GET / POST /api/send-progress-newsletter?period=weekly|monthly

import { createClient } from "@supabase/supabase-js";
import { getPreviousIsoWeek, getPreviousCalendarMonth, getPriorPeriodWindow } from "../src/utils/reportPeriods.js";
import { buildReportPayload } from "../src/utils/reportData.js";
import { renderReportEmailHtml } from "../src/utils/emailTemplate.js";
import { generateProgressReportContent } from "./generate-progress-report.js";

export default async function handler(req, res) {
  // Allow GET and POST for cron and manual triggers
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Security check: verify Bearer token matches CRON_SECRET if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing bearer token" });
    }
  }

  // 2. Determine period type ('weekly' or 'monthly')
  const queryPeriod = req.query?.period || req.body?.period;
  const periodType = queryPeriod === "monthly" ? "monthly" : "weekly";

  // 3. Compute period window and prior period comparison window
  const now = new Date();
  const { start: periodStart, end: periodEnd } =
    periodType === "monthly" ? getPreviousCalendarMonth(now) : getPreviousIsoWeek(now);
  const { start: priorStart, end: priorEnd } = getPriorPeriodWindow(periodType, periodStart, periodEnd);

  // 4. Initialize Supabase client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Supabase credentials not configured in environment" });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // 5. Idempotency safety check: check progress_reports for existing sent report
    const { data: existingReport, error: checkError } = await supabase
      .from("progress_reports")
      .select("*")
      .eq("period_type", periodType)
      .eq("period_start", periodStart)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.warn("Notice checking progress_reports table:", checkError.message);
    }

    if (existingReport && existingReport.sent_at) {
      return res.status(200).json({
        message: `Progress newsletter for ${periodType} period (${periodStart} to ${periodEnd}) was already sent`,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        sent_at: existingReport.sent_at,
        subject: existingReport.subject,
      });
    }

    // 6. Fetch raw data from Supabase
    const [logsRes, metricsRes, goalsRes, mapRes] = await Promise.all([
      supabase.from("workout_log").select("*").order("completed_at", { ascending: false }),
      supabase.from("body_metrics").select("*").order("date", { ascending: false }),
      supabase.from("training_goals").select("*").order("created_at", { ascending: false }),
      supabase.from("exercise_muscle_map").select("*"),
    ]);

    const rawLogs = logsRes.data || [];
    const bodyMetrics = metricsRes.data || [];
    const trainingGoals = goalsRes.data || [];
    const muscleMapRows = mapRes.data || [];

    // Filter prior period logs for delta comparison
    const priorPeriodLogs = rawLogs.filter((r) => {
      const d = r.completed_at?.slice(0, 10);
      return d && d >= priorStart && d <= priorEnd;
    });

    // 7. Aggregate data into compact summary payload
    const payload = buildReportPayload({
      rawLogs,
      bodyMetrics,
      trainingGoals,
      muscleMapLookup: muscleMapRows,
      periodStart,
      periodEnd,
      priorPeriodLogs,
      periodType,
    });

    // 8. Generate structured newsletter narrative via Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }

    let content = existingReport?.content;
    if (!content || typeof content !== "object") {
      content = await generateProgressReportContent({
        payload,
        periodType,
        periodStart,
        periodEnd,
        apiKey,
      });
    }

    // 9. Render email HTML template
    const emailHtml = renderReportEmailHtml(content, periodType, periodStart, periodEnd);

    // 10. Send via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const recipientEmail = process.env.RECIPIENT_EMAIL;
    const senderEmail = process.env.SENDER_EMAIL || "Workout Dashboard <onboarding@resend.dev>";

    let sentAt = null;
    let sendError = null;

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured. Skipping email dispatch.");
      sendError = "RESEND_API_KEY not configured";
    } else if (!recipientEmail) {
      console.warn("RECIPIENT_EMAIL not configured. Skipping email dispatch.");
      sendError = "RECIPIENT_EMAIL not configured";
    } else {
      try {
        const emailSubject = content.subject || `Progress Report: ${periodType} (${periodStart} to ${periodEnd})`;
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: senderEmail,
            to: [recipientEmail],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (!resendRes.ok) {
          const errBody = await resendRes.text();
          console.error("Resend API error:", resendRes.status, errBody);
          sendError = `Resend error (${resendRes.status}): ${errBody}`;
        } else {
          sentAt = new Date().toISOString();
        }
      } catch (err) {
        console.error("Failed to send email via Resend:", err);
        sendError = err.message || "Failed to dispatch email via Resend";
      }
    }

    // 11. Archive report row in progress_reports
    const reportRecord = {
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      generated_at: new Date().toISOString(),
      sent_at: sentAt,
      recipient_email: recipientEmail || null,
      subject: content.subject,
      content: content,
      metrics_snapshot: payload,
    };

    const { error: upsertError } = await supabase
      .from("progress_reports")
      .upsert(reportRecord, { onConflict: "period_type,period_start" });

    if (upsertError) {
      console.error("Failed to save progress_reports row:", upsertError);
    }

    // 12. Return outcome
    if (sendError && !sentAt) {
      return res.status(200).json({
        warning: "Report generated and saved, but email sending encountered an issue",
        sendError,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        subject: content.subject,
        content,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Progress newsletter sent successfully to ${recipientEmail}`,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      sent_at: sentAt,
      subject: content.subject,
      content,
    });
  } catch (err) {
    console.error("Error in send-progress-newsletter handler:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
