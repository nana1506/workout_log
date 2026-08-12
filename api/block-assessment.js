// api/block-assessment.js
// Vercel serverless function — keeps the Gemini API key server-side.
// Endpoint: POST /api/block-assessment

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
        const {
            acwrTrajectory,       // last 3-4 weeks { weekIndex, volume, chronic, acwr, isDeload, date }
            consecutivePlateaus,  // number of recent consecutive plateaus (numeric)
            recentInjuryRisks,    // number of recent watch/elevated flags (numeric)
            weeksSinceDeload,     // null or number of weeks
            recommendedMuscle,    // string representing muscle group
            secondaryStimulusCount // numeric count of secondary muscle stimuli
        } = req.body;

        const prompt = `You are an elite strength-training analyst and sports scientist.
Review a lifter's multi-week training indicators to assess if they need a deload week or if their current block is progressing normally.

Signals:
- ACWR Trajectory (recent weeks): ${JSON.stringify(acwrTrajectory || [])}
- Recent Consecutive Plateau Sessions: ${consecutivePlateaus}
- Recent Injury Risk (watch or elevated flags): ${recentInjuryRisks}
- Weeks Since Last Deload: ${weeksSinceDeload !== null ? weeksSinceDeload : 'none in visible window'}
- Recommended Target Muscle: ${recommendedMuscle}
- Recent Secondary Muscle Stimuli (across block window): ${secondaryStimulusCount || 0}

Rules for deload suggestion:
1. Suggest a deload (deloadRecommended: true) if ACWR is persistently high (>1.5), if injurywatch/elevated risk is flagged multiple times recently (>=2), if plateaus are persistent (consecutive plateaus >=2), or if they have trained hard for 6-8+ weeks without a deload.
2. Consider the additional systemic fatigue from secondary muscle stimulus (${secondaryStimulusCount || 0} events logged) which may increase overall recovery demands even if primary volume seems manageable.
3. If none of these high-fatigue indicators are present, do not suggest a deload.

Return ONLY a valid JSON object, no markdown fences, no preamble, matching this exact schema:
{
  "phaseAssessment": "A 1-sentence description of the current training block phase (e.g. 'Accumulation phase with rising chronic workload' or 'Overreaching detected')",
  "deloadRecommended": true,
  "deloadWindow": "e.g. 'Next 5-7 days' or 'Week 9' (string or null if not recommended)",
  "reasoning": "1-2 sentences citing the specific ACWR, plateau, injury watches, or secondary workload that led to your decision"
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', errText);
            return res.status(502).json({ error: 'Gemini API request failed', details: errText });
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        let parsed;
        try {
            parsed = JSON.parse(rawText.trim());
        } catch (parseErr) {
            console.error('Failed to parse Gemini response:', rawText);
            return res.status(502).json({ error: 'Malformed response from Gemini' });
        }

        // Validate required fields
        if (
            typeof parsed.phaseAssessment === 'undefined' ||
            typeof parsed.deloadRecommended === 'undefined' ||
            typeof parsed.reasoning === 'undefined'
        ) {
            return res.status(502).json({ error: 'Incomplete response from Gemini' });
        }

        return res.status(200).json(parsed);
    } catch (err) {
        console.error('block-assessment error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
