// api/parse-body-scan.js
// Vercel serverless function — keeps the Gemini API key server-side.
// Endpoint: POST /api/parse-body-scan

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
        const { image, mimeType } = req.body;

        if (!image || !mimeType) {
            return res.status(400).json({ error: 'Missing image data or mimeType' });
        }

        // Clean up base64 prefix if present
        let base64Data = image;
        if (base64Data.includes('base64,')) {
            base64Data = base64Data.split('base64,')[1];
        }

        const prompt = `You are an expert OCR and data extraction system designed to parse digital body composition scale screenshots (from apps like Renpho, Huawei Health, Mi Fit, Withings, etc.).

Analyze the provided image and extract all visible body composition metrics. Return a JSON object with the following keys, mapping exactly to these columns:
- date (The measurement date/time if visible on the screen. Format it as "YYYY-MM-DD" or standard ISO string. If no date/time is visible, return null)
- weight_kg (weight in kilograms, numeric)
- height_cm (height in centimeters, numeric)
- age (age in years, numeric)
- body_age (body age/biological age in years, numeric)
- bmi (Body Mass Index, numeric)
- fat_mass_pct (body fat percentage %, numeric)
- fat_mass_kg (body fat mass in kg, numeric)
- muscle_mass_pct (skeletal muscle percentage %, numeric)
- muscle_mass_kg (muscle mass in kg, numeric)
- visceral_fat (visceral fat index/level, numeric)
- bmr (basal metabolic rate in kcal, numeric)
- arm_left_muscle_kg (left arm muscle mass in kg, numeric)
- arm_right_muscle_kg (right arm muscle mass in kg, numeric)
- arm_left_fat_kg (left arm fat mass in kg, numeric)
- arm_right_fat_kg (right arm fat mass in kg, numeric)
- leg_left_muscle_kg (left leg muscle mass in kg, numeric)
- leg_right_muscle_kg (right leg muscle mass in kg, numeric)
- leg_left_fat_kg (left leg fat mass in kg, numeric)
- leg_right_fat_kg (right leg fat mass in kg, numeric)
- torso_muscle_kg (torso muscle mass in kg, numeric)
- torso_fat_kg (torso fat mass in kg, numeric)

Rules:
1. ONLY return a JSON object with these exact keys.
2. If a metric is not present or cannot be read with 100% confidence, return null for that key. Do not guess, estimate, or extrapolate.
3. All returned values must be numbers (or null), except the date key which is a string (or null). Do not include '%' or 'kg' in the numeric values.`;

        // Using gemini-2.5-flash for superior multimodal/OCR performance
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Data,
                                    }
                                },
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
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
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        let parsed;
        try {
            parsed = JSON.parse(rawText.trim());
        } catch (parseErr) {
            console.error('Failed to parse Gemini response:', rawText);
            return res.status(502).json({ error: 'Malformed response from Gemini' });
        }

        return res.status(200).json(parsed);
    } catch (err) {
        console.error('parse-body-scan error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
