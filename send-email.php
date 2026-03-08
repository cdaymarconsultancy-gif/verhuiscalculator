<?php
/**
 * send-email.php — Student Verhuis Dienst
 * Verwerkt offerte-aanvragen vanuit de verhuiscalculator.
 * Upload dit bestand naar je Hostinger webroot (zelfde map als index.html).
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Alleen POST toestaan
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Methode niet toegestaan.']);
  exit;
}

// Haal POST data op (JSON body)
$data = json_decode(file_get_contents('php://input'), true);

// Validatie
$toEmail = isset($data['to_email']) ? filter_var(trim($data['to_email']), FILTER_VALIDATE_EMAIL) : false;
$fromName = 'Student Verhuis Dienst';
$fromEmail = 'info@studentverhuisdienst.nl';
$replyTo = $fromEmail;

if (!$toEmail) {
  http_response_code(400);
  echo json_encode(['success' => false, 'message' => 'Ongeldig e-mailadres.']);
  exit;
}

// Offerte-gegevens uit de payload
$vanAdres = htmlspecialchars($data['van'] ?? 'Onbekend');
$naarAdres = htmlspecialchars($data['naar'] ?? 'Onbekend');
$volume = htmlspecialchars($data['volume'] ?? '?');
$uren = htmlspecialchars($data['uren'] ?? '?');
$km = htmlspecialchars($data['km'] ?? '?');
$woonFrom = htmlspecialchars($data['woon_from'] ?? 'Begane grond');
$woonTo = htmlspecialchars($data['woon_to'] ?? 'Begane grond');
$breakdown = htmlspecialchars($data['breakdown'] ?? '');
$subtotaal = htmlspecialchars($data['subtotaal'] ?? '?');
$btw = htmlspecialchars($data['btw'] ?? '?');
$totaal = htmlspecialchars($data['totaal'] ?? '?');

// E-mail onderwerp
$subject = "Uw verhuisofferte van Student Verhuis Dienst";

// HTML e-mail body
$htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verhuisofferte</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:32px 40px;text-align:center;">
          <img src="https://studentverhuisdienst.nl/assets/logo.png" alt="Student Verhuis Dienst Logo" style="height: 40px; margin-bottom: 12px; display:inline-block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <p style="display:none; margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,.7);letter-spacing:2px;text-transform:uppercase;">Student Verhuis Dienst</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:800;">Uw Verhuisofferte</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Transparante prijzen, geen verrassingen achteraf</p>
        </td>
      </tr>

      <!-- Route info -->
      <tr>
        <td style="padding:32px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#eff6ff;border-radius:10px;padding:16px 20px;" width="45%">
                <p style="margin:0;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Van</p>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1e293b;">$vanAdres</p>
                <p style="margin:2px 0 0;font-size:12px;color:#64748b;">$woonFrom</p>
              </td>
              <td align="center" width="10%" style="color:#2563eb;font-size:20px;">→</td>
              <td style="background:#eff6ff;border-radius:10px;padding:16px 20px;" width="45%">
                <p style="margin:0;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Naar</p>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1e293b;">$naarAdres</p>
                <p style="margin:2px 0 0;font-size:12px;color:#64748b;">$woonTo</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Stats -->
      <tr>
        <td style="padding:20px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 8px;" width="33%">
                <p style="margin:0;font-size:22px;font-weight:800;color:#1e293b;">$volume m³</p>
                <p style="margin:2px 0 0;font-size:11px;color:#64748b;">Geschat volume</p>
              </td>
              <td width="2%"></td>
              <td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 8px;" width="33%">
                <p style="margin:0;font-size:22px;font-weight:800;color:#1e293b;">$uren uur</p>
                <p style="margin:2px 0 0;font-size:11px;color:#64748b;">Geschatte werktijd</p>
              </td>
              <td width="2%"></td>
              <td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 8px;" width="33%">
                <p style="margin:0;font-size:22px;font-weight:800;color:#1e293b;">$km km</p>
                <p style="margin:2px 0 0;font-size:11px;color:#64748b;">Afstand</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Breakdown -->
      <tr>
        <td style="padding:24px 40px 0;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:1px;">Kostenopbouw</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <tr style="background:#f8fafc;">
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Omschrijving</th>
              <th style="padding:10px 16px;text-align:right;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Bedrag</th>
            </tr>
            $breakdown
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:10px 16px;font-size:13px;color:#64748b;">Subtotaal</td>
              <td style="padding:10px 16px;text-align:right;font-size:13px;color:#64748b;">$subtotaal</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:#64748b;">BTW (21%)</td>
              <td style="padding:10px 16px;text-align:right;font-size:13px;color:#64748b;">$btw</td>
            </tr>
            <tr style="background:#2563eb;">
              <td style="padding:14px 16px;font-size:15px;font-weight:800;color:#ffffff;">Totaal incl. BTW</td>
              <td style="padding:14px 16px;text-align:right;font-size:18px;font-weight:800;color:#ffffff;">$totaal</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Disclaimer -->
      <tr>
        <td style="padding:20px 40px 0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;background:#f8fafc;border-left:3px solid #2563eb;padding:10px 14px;border-radius:0 6px 6px 0;">
            ℹ️ Dit is een <strong>vrijblijvende indicatie</strong> op basis van uw opgegeven gegevens. De definitieve prijs wordt bepaald na een opname ter plaatse.
          </p>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="padding:28px 40px;" align="center">
          <a href="https://wa.me/31851234567" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;margin-right:12px;">
            💬 WhatsApp ons
          </a>
          <a href="mailto:info@studentverhuisdienst.nl" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
            📧 Mail ons
          </a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            <strong style="color:#1e293b;">Student Verhuis Dienst</strong> · info@studentverhuisdienst.nl · 085-1234567<br>
            Tiel &amp; Regio · © 2026
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>
HTML;

// Plain text fallback
$plainText = "Uw verhuisofferte van Student Verhuis Dienst\n\n"
  . "Van: $vanAdres ($woonFrom)\n"
  . "Naar: $naarAdres ($woonTo)\n"
  . "Volume: $volume m³ | Tijd: $uren uur | Afstand: $km km\n\n"
  . "Subtotaal: $subtotaal\n"
  . "BTW (21%): $btw\n"
  . "Totaal incl. BTW: $totaal\n\n"
  . "Dit is een vrijblijvende indicatie. Bel ons op 085-1234567 of mail info@studentverhuisdienst.nl.";

// Headers
$boundary = md5(uniqid());
$headers = implode("\r\n", [
  "From: $fromName <$fromEmail>",
  "Reply-To: $replyTo",
  "MIME-Version: 1.0",
  "Content-Type: multipart/alternative; boundary=\"$boundary\"",
  "X-Mailer: PHP/" . phpversion(),
]);

// Multipart body
$body = "--$boundary\r\n"
  . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
  . $plainText . "\r\n\r\n"
  . "--$boundary\r\n"
  . "Content-Type: text/html; charset=UTF-8\r\n\r\n"
  . $htmlBody . "\r\n\r\n"
  . "--$boundary--";

// Verstuur e-mail
$sent = mail($toEmail, $subject, $body, $headers);

// Stuur ook intern een kopie naar info@
$internalSubject = "Nieuwe offerteaanvraag — $vanAdres → $naarAdres";
mail($fromEmail, $internalSubject, $body, $headers);

if ($sent) {
  echo json_encode([
    'success' => true,
    'message' => "✅ Offerte verstuurd naar $toEmail. Check ook je spammap!"
  ]);
} else {
  http_response_code(500);
  echo json_encode([
    'success' => false,
    'message' => 'Verzenden mislukt. Probeer het opnieuw of neem contact op via WhatsApp.'
  ]);
}
