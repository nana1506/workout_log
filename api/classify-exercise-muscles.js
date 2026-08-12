// api/classify-exercise-muscles.js
// Vercel serverless function — keeps the Gemini API key server-side.
// Endpoint: POST /api/classify-exercise-muscles

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
        const { title, existingPrimary } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Missing required field: title' });
        }

        const prompt = `You are a fitness database and strength training expert.
Analyze the following exercise and classify its primary and secondary muscle groups.

Exercise title: "${title}"
Currently logged primary muscle (hint, but correct if wrong): "${existingPrimary || ''}"

Valid muscle group choices:
- abdominals
- abductors
- adductors
- biceps
- calves
- chest
- full_body
- hamstrings
- lats
- quadriceps
- shoulders
- traps
- triceps
- upper_back

Return ONLY a valid JSON object (no markdown formatting, no code block backticks) matching this exact schema:
{
  "primary_muscle": "one of the valid muscle groups listed above",
  "secondary_muscles": [
    {
      "muscle_group": "one of the valid muscle groups listed above",
      "contribution": 0.2
    }
  ]
}

Only include genuinely significant secondary muscles (contribution should be between 0.1 and 0.5). If no significant secondary muscles exist, secondary_muscles should be an empty array [].`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
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

        if (!parsed.primary_muscle || !Array.isArray(parsed.secondary_muscles)) {
            console.error('Gemini response missing required keys:', parsed);
            return res.status(502).json({ error: 'Incomplete response from Gemini' });
        }

        const validMuscles = [
            'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest',
            'full_body', 'hamstrings', 'lats', 'quadriceps', 'shoulders', 'traps',
            'triceps', 'upper_back'
        ];

        if (!validMuscles.includes(parsed.primary_muscle)) {
            console.error('Invalid primary muscle returned:', parsed.primary_muscle);
            return res.status(502).json({ error: `Invalid primary_muscle: ${parsed.primary_muscle}` });
        }

        for (const sec of parsed.secondary_muscles) {
            if (!sec.muscle_group || !validMuscles.includes(sec.muscle_group)) {
                console.error('Invalid secondary muscle group returned:', sec.muscle_group);
                return res.status(502).json({ error: `Invalid secondary muscle group: ${sec.muscle_group}` });
            }
            if (typeof sec.contribution !== 'number' || isNaN(sec.contribution)) {
                console.error('Invalid secondary contribution returned:', sec.contribution);
                return res.status(502).json({ error: `Invalid contribution: ${sec.contribution}` });
            }
        }

        return res.status(200).json(parsed);
    } catch (err) {
        console.error('classify-exercise-muscles error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
