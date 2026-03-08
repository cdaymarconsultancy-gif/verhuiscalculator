export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { images } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAoWNT1TuSqpmulfbTikHuh7NfUyagXzn4'; // Nieuwe sleutel als backup

    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-2.0-flash'
    ];

    const prompt = `Je bent een verhuis-taxateur. Bekijk de foto zorgvuldig en lijst ALLE meubels op.
    Ik zie op deze foto's in ieder geval een grote BANK. Zorg dat je deze en alle andere items (stoelen, tafels, kasten) herkent.
    
    Antwoord in dit JSON formaat:
    [{"name": "Bank", "vol": 1.5, "icon": "🛋️", "montageRequired": true, "montageMinutes": 20, "qty": 1}]`;

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                ...images.map(img => ({
                    inlineData: { mimeType: img.mimeType, data: img.base64 }
                }))
            ]
        }]
    };

    for (const modelName of models) {
        for (const version of ['v1beta', 'v1']) {
            try {
                const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    const result = await response.json();
                    const outputText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
                    const match = outputText.match(/\[[\s\S]*\]/);
                    if (match) {
                        return res.status(200).json(JSON.parse(match[0]));
                    }
                }
            } catch (e) {
                console.error(`Error with ${modelName}:`, e);
            }
        }
    }

    return res.status(500).json({ error: 'AI kon geen items herkennen' });
}
