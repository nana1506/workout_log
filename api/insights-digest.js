// api/insights-digest.js
// Vercel serverless function — keeps the Gemini API key server-side.
// Endpoint: POST /api/insights-digest

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
        const { events, summary } = req.body || {};

        if (!Array.isArray(events)) {
            return res.status(400).json({ error: 'Missing or invalid events array' });
        }

        const validEventIds = events.map(e => e.id).filter(Boolean);

        const prompt = `You are an expert strength & conditioning sports analyst.
Review the following deterministic training events and summary metrics:

Summary Metrics:
- Recent Volume Trend (vs prior period): ${summary?.recentVolumeTrend != null ? summary.recentVolumeTrend + '%' : 'N/A'}
- Recent RPE Avg: ${summary?.rpeAvgTrend != null ? summary.rpeAvgTrend : 'N/A'}
- 1RM Slope: ${summary?.oneRmSlope != null ? summary.oneRmSlope + ' kg/session' : 'N/A'}
- ACWR Zone: ${summary?.acwrZone || 'N/A'}
- Push/Pull Ratio: ${summary?.pushPullRatio != null ? summary.pushPullRatio : 'N/A'}
- Quad/Hamstring Ratio: ${summary?.quadHamstringRatio != null ? summary.quadHamstringRatio : 'N/A'}

Noteworthy Events Logged (Deterministic Event IDs):
${JSON.stringify(events, null, 2)}

Instructions:
1. Write a 2-4 sentence plain-language narrative digest of the current training picture, explicitly referencing the key summary numbers or events.
2. For each event ID in the provided events list, write a concise 3-6 word caption suitable for a chart label. Do NOT invent new event IDs. Only include event IDs that were explicitly provided in the input list.

Return ONLY a valid JSON object (no markdown fences, no preamble) in this exact schema:
{
  "narrative": "2-4 sentence plain-language digest of the training picture...",
  "captions": {
    ${validEventIds.map(id => `"${id}": "3-6 word caption"`).join(',\n    ')}
  }
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
                        maxOutputTokens: 500,
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
            const cleaned = rawText.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('Failed to parse Gemini response:', rawText);
            return res.status(502).json({ error: 'Malformed response from Gemini' });
        }

        if (typeof parsed.narrative !== 'string' || typeof parsed.captions !== 'object' || parsed.captions === null) {
            console.error('Incomplete response shape from Gemini:', parsed);
            return res.status(502).json({ error: 'Incomplete response shape from Gemini' });
        }

        // Server-side validation: confirm captions keys are a subset of the valid event IDs sent
        const validIdSet = new Set(validEventIds);
        const captionKeys = Object.keys(parsed.captions);

        const invalidKeys = captionKeys.filter(key => !validIdSet.has(key));
        if (invalidKeys.length > 0) {
            console.warn(`Gemini response included unrequested event IDs: ${invalidKeys.join(', ')}. Filtering out.`);
            // Filter invalid keys out
            const filteredCaptions = {};
            for (const key of captionKeys) {
                if (validIdSet.has(key)) {
                    filteredCaptions[key] = parsed.captions[key];
                }
            }
            parsed.captions = filteredCaptions;
        }

        return res.status(200).json(parsed);
    } catch (err) {
        console.error('insights-digest error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
