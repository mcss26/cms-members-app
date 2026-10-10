// Supabase Edge Function: bulk-email-csv
// Handles bulk email sending for members uploaded via CSV using Resend Batch API.
// Deploy with: supabase functions deploy bulk-email-csv

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://midnightclub.com.ar",
  "https://www.midnightclub.com.ar",
  "https://mcss26.github.io"
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface BulkEmailCsvRequest {
  isTest?: boolean;
  testEmail?: string;
  freeLink: string;
  contacts: { nombre: string; email: string }[];
}

// Generador del HTML de la plantilla
function generateEmailHtml(freeLink: string): string {
  const descriptionText = "¡Felicidades! Recibiste una invitación para este sábado. ¡Te esperamos!";
  const ctaText = "OBTENER FREE PASS";
  const footerText = "VÁLIDO HASTA LAS 2:00 &bull; SUJETO A CAPACIDAD";
  
  return `
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  
  <!-- Universal Color Scheme Directives: Prevent Auto-Inversion -->
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Member Pass - Midnight Club</title>

  <!-- Outlook DPI Fixes -->
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->

  <!-- Google Fonts: Plus Jakarta Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Email Client Specific Fallbacks & Dark Mode Locks -->
  <style type="text/css">
    :root {
      color-scheme: light only;
      supported-color-schemes: light only;
    }

    /* Client Resets */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-height: 100% !important;
      background-color: #050505 !important;
      -webkit-text-size-adjust: 100% !important;
      -ms-text-size-adjust: 100% !important;
    }

    body, table, td, p, a, span, h1, h2 {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Outlook.com Dark Mode Overrides */
    [data-ogsc] body, [data-ogsb] body,
    [data-ogsc] .dark-bg, [data-ogsb] .dark-bg {
      background-color: #050505 !important;
    }
    [data-ogsc] .dark-card, [data-ogsb] .dark-card {
      background-color: #0B0B0E !important;
    }
    [data-ogsc] .dark-text-white, [data-ogsb] .dark-text-white {
      color: #FFFFFF !important;
    }
    [data-ogsc] .dark-text-muted, [data-ogsb] .dark-text-muted {
      color: #9CA3AF !important;
    }

    /* Gmail App Anti-Inversion Rules */
    u + .body .dark-bg {
      background-color: #050505 !important;
    }
    u + .body .dark-card {
      background-color: #0B0B0E !important;
    }
    u + .body .header-title {
      color: #FFFFFF !important;
      -webkit-text-fill-color: #FFFFFF !important;
    }
    u + .body .btn-primary {
      background-color: #FFFFFF !important;
      color: #050505 !important;
      -webkit-text-fill-color: #050505 !important;
    }
    u + .body .btn-primary span {
      color: #050505 !important;
      -webkit-text-fill-color: #050505 !important;
    }

    /* Prevent Apple Mail & iOS from altering link styling */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    /* Interactive hover states */
    .hover-card:hover {
      border-color: rgba(255, 255, 255, 0.25) !important;
    }
    .btn-primary:hover {
      background-color: #F4F4F5 !important;
      opacity: 0.95 !important;
    }
  </style>
</head>

<body class="body dark-bg"
      bgcolor="#050505" 
      style="margin: 0; padding: 40px 12px; width: 100%; min-height: 100%; background-color: #050505; background-image: linear-gradient(#050505, #050505); color: #E5E7EB; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-align: center;">

  <!-- Outer Centering Table for Full Email Client Compatibility -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050505" style="width: 100%; margin: 0; padding: 0; background-color: #050505; background-image: linear-gradient(#050505, #050505);">
    <tr>
      <td align="center" valign="top" style="padding: 0;">

        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0">
        <tr>
        <td align="center" valign="top">
        <![endif]-->

        <!-- Main Card Container (max-width: 600px) -->
        <table role="presentation" 
               class="dark-card" 
               width="100%" 
               cellpadding="0" 
               cellspacing="0" 
               border="0" 
               bgcolor="#0B0B0E" 
               style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #0B0B0E; background-image: linear-gradient(#0B0B0E, #0B0B0E); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; text-align: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);">

          <!-- ================= HEADER SECTION ================= -->
          <tr>
            <td align="center" 
                style="padding: 44px 28px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background-color: #111116; background-image: linear-gradient(#13131A, #0B0B0E);">
              
              <!-- Brand Logo / Wordmark -->
              <h1 class="header-title" 
                  style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; line-height: 1.2;">
                <span style="color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important;">MIDNIGHT CLUB</span>
              </h1>

              <!-- Dynamic Exclusive Member Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 16px auto 0;">
                <tr>
                  <td style="padding: 6px 16px; background-color: #141419; background-image: linear-gradient(#141419, #141419); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 9999px;">
                    <span style="font-size: 10px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase; color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; display: inline-block;">
                      INVITACIÓN EXCLUSIVA
                    </span>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ================= BODY CONTENT ================= -->
          <tr>
            <td align="center" 
                style="padding: 36px 28px 44px;">

              <!-- Lead Greeting Text -->
              <!-- Variable: ${descriptionText} -->
              <p style="margin: 0 auto 32px; max-width: 440px; font-size: 14px; line-height: 1.7; color: #D1D5DB !important; -webkit-text-fill-color: #D1D5DB !important; font-weight: 400; text-align: center;">
                <span style="color: #D1D5DB !important; -webkit-text-fill-color: #D1D5DB !important;">${descriptionText}</span>
              </p>

              <!-- ================= HERO PASS BLOCK: FREE PASS ================= -->
              <table role="presentation" 
                     class="hover-card" 
                     width="100%" 
                     cellpadding="0" 
                     cellspacing="0" 
                     border="0" 
                     bgcolor="#14141A" 
                     style="width: 100%; margin: 0 0 32px; background-color: #14141A; background-image: linear-gradient(#16161D, #111116); border: 1px solid rgba(255, 255, 255, 0.1); border-top: 2px solid #34D399; border-radius: 12px; overflow: hidden; text-align: center;">
                <tr>
                  <td style="padding: 26px 22px 24px;">
                    
                    <!-- Tier Header Label -->
                    <div style="margin: 0 0 16px; text-align: center;">
                      <span style="font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #34D399 !important; -webkit-text-fill-color: #34D399 !important; display: inline-block;">
                        ACCESO HABILITADO
                      </span>
                    </div>

                    <!-- Primary CTA Button (Solid High-Contrast White) -->
                    <!-- Variables: ${freeLink} & ${ctaText} -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0 16px;">
                      <tr>
                        <td align="center">
                          <a href="${freeLink}" 
                             class="btn-primary" 
                             style="display: block; width: 100%; box-sizing: border-box; background-color: #FFFFFF; background-image: linear-gradient(#FFFFFF, #FFFFFF); color: #050505 !important; -webkit-text-fill-color: #050505 !important; text-decoration: none; padding: 16px 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; text-align: center; border: 1px solid #FFFFFF;">
                            <span style="color: #050505 !important; -webkit-text-fill-color: #050505 !important; font-weight: 700;">${ctaText}</span>
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Secondary Conditions -->
                    <!-- Variable: ${footerText} -->
                    <p style="margin: 0; font-size: 11px; line-height: 1.6; color: #D1D5DB !important; -webkit-text-fill-color: #D1D5DB !important; font-weight: 400; letter-spacing: 1px;">
                      <span style="color: #D1D5DB !important; -webkit-text-fill-color: #D1D5DB !important;">${footerText}</span>
                    </p>

                  </td>
                </tr>
              </table>

              <!-- Minimal Hairline Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
                <tr>
                  <td style="border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
              </table>

              <!-- ================= FOOTER SECTION ================= -->
              <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; text-align: center;">
                <span style="color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important;">MIDNIGHT CLUB EXPERIENCE</span>
              </p>
              <p style="margin: 0; font-size: 9px; font-weight: 400; letter-spacing: 1.5px; text-transform: uppercase; color: #52525B !important; -webkit-text-fill-color: #52525B !important; text-align: center;">
                <span style="color: #52525B !important; -webkit-text-fill-color: #52525B !important;">ACCESO EXCLUSIVO CON DNI &bull; DERECHO DE ADMISIÓN RESERVADO</span>
              </p>

            </td>
          </tr>

        </table>
        <!-- End Main Card Container -->

        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>

</body>
</html>
`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const jsonResponse = (data: unknown, status = 200) => 
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const body: BulkEmailCsvRequest = await req.json();
    const { isTest, testEmail, freeLink, contacts } = body;

    if (!freeLink) {
      return jsonResponse({ error: "Falta el link de la campaña" }, 400);
    }

    if (isTest) {
      if (!testEmail) {
        return jsonResponse({ error: "Email de prueba requerido" }, 400);
      }

      const html = generateEmailHtml(freeLink);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Midnight Club <noreply@midnightclub.com.ar>",
          to: testEmail,
          subject: "Invitación Exclusiva - Midnight Club",
          html: html,
        }),
      });

      const emailResult = await emailResponse.json();
      if (!emailResponse.ok) {
        throw new Error(emailResult.message || "Error al enviar email de prueba");
      }
      return jsonResponse({ success: true, message: "Prueba enviada" });
    }

    // Modo Masivo (Batch API)
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return jsonResponse({ error: "No hay contactos para enviar" }, 400);
    }

    if (contacts.length > 100) {
      return jsonResponse({ error: "Demasiados contactos, el máximo por lote es 100" }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const batchPayload = contacts.map(c => {
        let validEmail = c.email && typeof c.email === 'string' ? c.email.trim().toLowerCase() : "";
        if (!emailRegex.test(validEmail)) {
           console.warn("Invalid email in batch, skipping:", validEmail);
           return null;
        }

        return {
            from: "Midnight Club <noreply@midnightclub.com.ar>",
            to: validEmail,
            subject: "Invitación Exclusiva - Midnight Club",
            html: generateEmailHtml(freeLink)
        };
    }).filter(e => e !== null);

    if (batchPayload.length === 0) {
        return jsonResponse({ success: true, processedCount: 0, sentCount: 0, message: "Ningún contacto válido en este lote" });
    }

    const batchResponse = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batchPayload),
    });

    const batchResult = await batchResponse.json();
    if (!batchResponse.ok) {
       console.error("Resend Batch Error:", batchResult);
       throw new Error(batchResult.message || "Error al enviar lote");
    }

    return jsonResponse({
        success: true,
        processedCount: contacts.length,
        sentCount: batchPayload.length,
        message: "Lote enviado a Resend"
    });

  } catch (err: any) {
    console.error("Function error:", err.message);
    return jsonResponse({ error: err.message || "Error interno del servidor" }, 500);
  }
});
