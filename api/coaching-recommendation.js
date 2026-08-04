// api/coaching-recommendation.js
// Vercel serverless function — keeps the Gemini API key server-side.
// Endpoint: POST /api/coaching-recommendation

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
            recommendedMuscle,
            isRecovered,
            acwr,
            acwrZoneLabel,
            recentRpeTrend,      // e.g. [7, 7.5, 8, 8.5]
            plateauStatus,       // { isPlateaued, sessionsFlat }
            injuryRiskFlag,      // { level, reason }
            lastSession,         // { exerciseName, weight, reps }
        } = req.body;

        if (!recommendedMuscle || !lastSession) {
            return res.status(400).json({ error: 'Missing required signals' });
        }

        const prompt = `You are a strength-training coach reviewing a lifter's recent data.
Give a short, direct coaching recommendation based on these signals:

- Recommended muscle group to train next: ${recommendedMuscle} (${isRecovered ? 'fully recovered' : 'still recovering'})
- Acute:Chronic Workload Ratio: ${acwr} (${acwrZoneLabel})
- Recent RPE trend: ${JSON.stringify(recentRpeTrend)}
- Plateau status: ${plateauStatus?.isPlateaued ? `flat for ${plateauStatus.sessionsFlat} sessions` : 'progressing normally'}
- Injury risk flag: ${injuryRiskFlag?.level || 'none'}${injuryRiskFlag?.reason ? ` (${injuryRiskFlag.reason})` : ''}
- Last session: ${lastSession.exerciseName} at ${lastSession.weight}kg x ${lastSession.reps} reps

Respond ONLY with valid JSON, no markdown fences, no preamble, in this exact shape:
{
  "recommendationText": "2-4 sentence coaching recommendation in plain language",
  "targetRecommendation": "one short line with a specific weight/rep target for the next session"
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 300,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', errText);
            return res.status(502).json({ error: 'Gemini API request failed' });
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        let parsed;
        try {
            const cleaned = rawText.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('Failed to parse Gemini response:', rawText);
            return res.status(502).json({ error: 'Malformed response from Gemini' });
        }

        if (!parsed.recommendationText || !parsed.targetRecommendation) {
            return res.status(502).json({ error: 'Incomplete response from Gemini' });
        }

        return res.status(200).json(parsed);
    } catch (err) {
        console.error('coaching-recommendation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}