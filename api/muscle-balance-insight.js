// api/muscle-balance-insight.js
// Vercel serverless function — keeps the Gemini API key server-side.
// Endpoint: POST /api/muscle-balance-insight

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
            pushPullRatio,
            quadHamstringRatio,
            neglectedMuscles,
            windowDays,
            totalVolumeByMuscle,
        } = req.body;

        if (pushPullRatio == null && quadHamstringRatio == null) {
            return res.status(400).json({ error: 'No balance ratios provided — insufficient training data' });
        }

        const prompt = `You are a concise sports-science advisor reviewing a lifter's muscle-balance data from the last ${windowDays || 28} days.

Here are the computed ratios and data — ONLY comment on what is provided below, do not invent additional exercise recommendations or claim data you were not given:

- Push / Pull volume ratio: ${pushPullRatio != null ? pushPullRatio : 'N/A (insufficient data)'}
  (ideal ≈ 1.0; >1.4 = caution, >1.8 = warning)
- Quadriceps / Hamstring volume ratio: ${quadHamstringRatio != null ? quadHamstringRatio : 'N/A (insufficient data)'}
  (ideal ≈ 1.0–1.5; >1.8 = warning)
- Neglected muscles (near-zero volume relative to their functional pair): ${neglectedMuscles && neglectedMuscles.length > 0 ? JSON.stringify(neglectedMuscles) : 'none'}
- Volume by muscle group: ${JSON.stringify(totalVolumeByMuscle || {})}

Respond ONLY with valid JSON, no markdown fences, no preamble, in this exact shape:
{
  "summary": "1-2 sentence plain-language read of the balance situation",
  "suggestedFix": "1 specific, actionable suggestion (e.g. a muscle to prioritize and roughly how, not a full program)"
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 250,
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
            const cleaned = rawText.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('Failed to parse Gemini response:', rawText);
            return res.status(502).json({ error: 'Malformed response from Gemini' });
        }

        if (!parsed.summary || !parsed.suggestedFix) {
            return res.status(502).json({ error: 'Incomplete response from Gemini' });
        }

        return res.status(200).json(parsed);
    } catch (err) {
        console.error('muscle-balance-insight error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
