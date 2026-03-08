<?php
/**
 * pandadoc-bridge.php — Student Verhuis Dienst
 * Directe koppeling met PandaDoc API (geen Zapier nodig).
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// ==========================================
// CONFIGURATIE (Hier je eigen data invullen)
// ==========================================
$apiKey = "JOUW_PANDADOC_API_KEY"; // Haal op in PandaDoc -> Settings -> API
$templateId = "JOUW_TEMPLATE_ID";   // ID van je offerte template

if ($apiKey === "JOUW_PANDADOC_API_KEY") {
    echo json_encode(['success' => false, 'message' => 'API Key niet ingesteld in pandadoc-bridge.php']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => 'Geen data ontvangen']);
    exit;
}

// Data voor PandaDoc voorbereiden
$postData = [
    "name" => "Offerte - " . ($input['van'] ?? 'Nieuwe Klant'),
    "template_uuid" => $templateId,
    "recipients" => [
        [
            "email" => $input['client_email'],
            "first_name" => "Klant",
            "role" => "Client"
        ]
    ],
    "tokens" => [
        ["name" => "Datum", "value" => $input['datum']],
        ["name" => "Van", "value" => $input['van']],
        ["name" => "Naar", "value" => $input['naar']],
        ["name" => "Volume", "value" => $input['volume']],
        ["name" => "Uren", "value" => $input['uren']],
        ["name" => "Afstand", "value" => $input['afstand']],
        ["name" => "Totaalprijs", "value" => $input['totaal_prijs']]
    ],
    "metadata" => [
        "source" => "Calculator"
    ]
];

$ch = curl_init("https://api.pandadoc.com/public/v1/documents");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: API-Key $apiKey",
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 201) {
    echo json_encode(['success' => true, 'message' => 'Offerte succesvol aangemaakt in PandaDoc!']);
} else {
    echo json_encode(['success' => false, 'message' => 'PandaDoc Error: ' . $response, 'code' => $httpCode]);
}
