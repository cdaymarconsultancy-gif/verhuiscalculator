export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Geen afbeeldingen ontvangen' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMENI_API_KEY || 'AIzaSyAoWNT1TuSqpmulfbTikHuh7NfUyagXzn4';

    // Prioriteit voor modellen en versies
    const models = [
        { name: 'gemini-1.5-flash', version: 'v1beta' },
        { name: 'gemini-1.5-flash-8b', version: 'v1beta' },
    ];

    const prompt = `Je bent een expert verhuis-taxateur. Analyseer de foto(s) en maak een lijst van meubels en witgoed.
    
    RICHTLIJNEN:
    - Identificeer elk meubelstuk (bank, tafel, kast, bed, etc.).
    - Schat het volume in m3 (bijv 1.5 voor een bank).
    - Geef aan of montage/demontage nodig is.
    - Antwoord ALLEEN in JSON formaat (een array van objecten).
    
    FORMAAT:
    [{"name": "Bank", "vol": 1.5, "icon": "🛋️", "montageRequired": true, "montageMinutes": 20, "qty": 1}]`;

    const limitedImages = images.slice(0, 2);

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
            response_mime_type: "application/json",
            temperature: 0.1
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    let lastError = null;

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const responseData = await response.json();

            if (response.ok) {
                const outputText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
                try {
                    const cleanJson = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.inventory || []);
                    return res.status(200).json(items);
                } catch (pe) {
                    console.error("Parse fail:", outputText);
                    const match = outputText.match(/\[[\s\S]*\]/);
                    if (match) return res.status(200).json(JSON.parse(match[0]));
                    return res.status(200).json({ error: "AI output onleesbaar", raw: outputText });
                }
            } else {
                lastError = responseData.error?.message || `Status ${response.status}`;
                console.error(`Gemini Error (${model.name}):`, lastError);
                if (response.status === 429) continue; // Alleen bij rate limit proberen we volgende
                if (response.status === 400 && lastError.includes("API key")) {
                    return res.status(403).json({ error: "API Sleutel Ongeldig of Verlopen. Controleer Vercel Settings." });
                }
                return res.status(response.status).json({ error: lastError });
            }
        } catch (e) {
            lastError = e.message;
            console.warn(`Model ${model.name} failed:`, e);
        }
    }

    return res.status(500).json({
        error: `AI herkenning mislukt: ${lastError || 'Geen verbinding mogelijk'}`,
        suggestion: "Controleer of de Gemini API key correct is ingesteld in Vercel."
    });
}
