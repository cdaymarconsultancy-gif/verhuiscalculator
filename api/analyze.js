export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Geen afbeeldingen ontvangen' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMENI_API_KEY || 'AIzaSyAoWNT1TuSqpmulfbTikHuh7NfUyagXzn4';

    // Terug naar de meest stabiele combinaties zonder te veel poespas
    const models = [
        { name: 'gemini-1.5-flash', version: 'v1' },
        { name: 'gemini-1.5-flash', version: 'v1beta' },
        { name: 'gemini-1.5-pro', version: 'v1beta' }
    ];

    const prompt = `Je bent een expert verhuis-taxateur. Analyseer de foto's en geef een JSON lijst van meubels.
Richtlijnen: 
- Schat volume in m3 (Bank: 1.5, Grote hoekbank: 3.0, Stoel: 0.2, Kast: 1.0, Wasmachine: 0.5).
- Geef aan of montageRequired (true/false) en schat montageMinutes (tijd nodig voor (de)montage).
- Gebruik alleen Nederlands.

Belangrijk: Antwoord ALLEEN met de JSON array, geen andere tekst.
FORMAAT: [{"name": "Bank", "vol": 1.5, "icon": "🛋️", "montageRequired": true, "montageMinutes": 20, "qty": 1}]`;

    // Beperk tot 2-3 foto's voor maximale stabiliteit
    const limitedImages = images.slice(0, 3);

    let lastError = "";

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${apiKey}`;

            // Simpele request body zonder responseMimeType (voor maximale compatibiliteit)
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
                    temperature: 0.2
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (response.ok) {
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
                try {
                    // Probeer de JSON te vinden in de tekst (voor het geval de AI toch tekst toevoegt)
                    const jsonMatch = text.match(/\[[\s\S]*\]/);
                    const cleanJson = jsonMatch ? jsonMatch[0] : text;
                    const parsed = JSON.parse(cleanJson);
                    return res.status(200).json(Array.isArray(parsed) ? parsed : []);
                } catch (e) {
                    console.error("Parse error on model", model.name, e);
                    continue; // Probeer volgende model
                }
            } else {
                lastError = data.error?.message || JSON.stringify(data.error) || `Status ${response.status}`;
                continue;
            }
        } catch (err) {
            lastError = err.message;
            continue;
        }
    }

    return res.status(500).json({
        error: `[v2.3] AI-verbinding mislukt. Laatste fout: ${lastError}`,
        suggestion: "Controleer de API-sleutel of probeer het met minder foto's."
    });
}
