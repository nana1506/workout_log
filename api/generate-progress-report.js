// api/generate-progress-report.js
// Vercel serverless function — generates structured progress newsletter content via Gemini.
// Endpoint: POST /api/generate-progress-report

/**
 * Core generation helper function for progress reports.
 * Can be called directly by other serverless functions without internal HTTP hops.
 */
export async function generateProgressReportContent({
  payload,
  periodType = "weekly",
  periodStart,
  periodEnd,
  apiKey,
}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const periodLabel = periodType === "monthly" ? "Monthly" : "Weekly";

  const prompt = `You are an expert strength & conditioning coach writing a personalized ${periodLabel} Progress Newsletter for a dedicated lifter.
Review the following deterministic training summary and metrics for the period (${periodStart} to ${periodEnd}):

${JSON.stringify(payload, null, 2)}

Instructions:
1. Write in a warm, encouraging, yet analytical and concise tone (like an elite personal coach).
2. Ground all insights strictly in the provided data. Do not fabricate numbers, exercises, or scans not present in the payload.
3. If no body composition scans were logged in this period (bodyComp is null or scansCount is 0), set "bodyComposition": null.
4. "lookingAhead" must be structured as 2-3 bullet action pointers (e.g. starting with 🎯, ⚡, or 📌). Bold key terms and targets (e.g. **+2.5kg on Squats**, **RPE 8 cap**, or **Hamstrings focus**) so they can be emphasized and highlighted.
5. "notableEvents" should celebrate PRs achieved, mention medal level (🥇 3+ PRs, 🥈 1-2 PRs, 🥉 Consistency), or note fatigue/plateau observations if present.

Return ONLY a valid JSON object (no markdown fences, no preamble, no backticks) in this exact schema:
{
  "subject": "Compelling, concise email subject line (e.g. 'Weekly Progress: Bench PR & +12% Volume Bump')",
  "highlights": "2-3 punchy sentences covering the absolute top highlights and overall momentum",
  "trainingSummary": "Concise paragraph analyzing weekly volume load, session consistency, and training density",
  "bodyComposition": "Brief paragraph on weight and body composition trends (or null if no scans logged in window)",
  "goalProgress": "Status update on active training goals and milestones",
  "muscleBalance": "Analysis of push/pull balance, quad/hamstring ratios, and any neglected muscle groups",
  "notableEvents": "Celebration of new PRs, plateaus detected, or fatigue/injury-risk alerts",
  "lookingAhead": "2-3 bulleted action pointers with key targets bolded (e.g. '* 🎯 **Add +2.5kg** on Bench Press sets next week.\\n* ⚡ **Deload** leg volume by 10% to manage fatigue.')"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error in generate-progress-report:", errText);
    throw new Error(`Gemini API request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  let parsed;
  try {
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error("Failed to parse Gemini response:", rawText);
    throw new Error("Malformed JSON response from Gemini");
  }

  // Validate JSON shape
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.subject !== "string" ||
    typeof parsed.highlights !== "string" ||
    typeof parsed.trainingSummary !== "string"
  ) {
    console.error("Incomplete response shape from Gemini:", parsed);
    throw new Error("Incomplete progress report shape returned from Gemini");
  }

  return {
    subject: parsed.subject,
    highlights: parsed.highlights,
    trainingSummary: parsed.trainingSummary,
    bodyComposition: typeof parsed.bodyComposition === "string" ? parsed.bodyComposition : null,
    goalProgress: typeof parsed.goalProgress === "string" ? parsed.goalProgress : null,
    muscleBalance: typeof parsed.muscleBalance === "string" ? parsed.muscleBalance : null,
    notableEvents: typeof parsed.notableEvents === "string" ? parsed.notableEvents : null,
    lookingAhead: typeof parsed.lookingAhead === "string" ? parsed.lookingAhead : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  try {
    const { payload, periodType, periodStart, periodEnd } = req.body || {};

    if (!payload || !periodStart || !periodEnd) {
      return res.status(400).json({ error: "Missing required payload, periodStart, or periodEnd" });
    }

    const content = await generateProgressReportContent({
      payload,
      periodType: periodType || "weekly",
      periodStart,
      periodEnd,
      apiKey,
    });

    return res.status(200).json(content);
  } catch (err) {
    console.error("Progress report generation handler error:", err);
    return res.status(502).json({ error: err.message || "Failed to generate progress report" });
  }
}
