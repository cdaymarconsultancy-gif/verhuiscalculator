export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Geen afbeeldingen ontvangen' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMENI_API_KEY || 'AIzaSyAoWNT1TuSqpmulfbTikHuh7NfUyagXzn4';

    // We breiden de lijst uit met de meest stabiele en nieuwste varianten
    const models = [
        { name: 'gemini-1.5-flash-8b', version: 'v1beta' },
        { name: 'gemini-1.5-flash-latest', version: 'v1beta' },
        { name: 'gemini-1.5-flash', version: 'v1beta' },
        { name: 'gemini-1.5-flash', version: 'v1' },
        { name: 'gemini-1.5-flash-001', version: 'v1beta' },
        { name: 'gemini-1.5-pro-latest', version: 'v1beta' }
    ];

    const prompt = `Je bent een expert verhuis-taxateur. Analyseer de foto's en geef een JSON lijst van meubels.
Richtlijnen: 
- Schat volume in m3 (Bank: 1.5, Grote hoekbank: 3.0, Stoel: 0.2, Kast: 1.0, Wasmachine: 0.5).
- Geef aan of montageRequired (true/false) en schat montageMinutes (tijd nodig voor (de)montage).
- Gebruik alleen Nederlands.

FORMAAT: [{"name": "Bank", "vol": 1.5, "icon": "🛋️", "montageRequired": true, "montageMinutes": 20, "qty": 1}]`;

    const limitedImages = images.slice(0, 3);
    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                ...limitedImages.map(img => ({
                    inlineData: { mimeType: img.mimeType, data: img.base64 }
                }))
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
        }
    };

    let lastError = "";

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (response.ok) {
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
                try {
                    const parsed = JSON.parse(text);
                    return res.status(200).json(Array.isArray(parsed) ? parsed : (parsed.items || []));
                } catch (e) {
                    const match = text.match(/\[.*\]/s);
                    if (match) return res.status(200).json(JSON.parse(match[0]));
                    continue;
                }
            } else {
                lastError = data.error?.message || JSON.stringify(data.error) || `Status ${response.status}`;
                console.warn(`Model ${model.name} (${model.version}) failed:`, lastError);
                continue;
            }
        } catch (err) {
            lastError = err.message;
            continue;
        }
    }

    return res.status(500).json({
        error: `[v2.2] AI herkenning mislukt. Laatste poging: ${lastError}`,
        suggestion: "Probeer het over een minuutje nog een keer of voeg items handmatig toe."
    });
}
