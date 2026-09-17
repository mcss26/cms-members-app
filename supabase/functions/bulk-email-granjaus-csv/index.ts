// Supabase Edge Function: bulk-email-granjaus-csv
// Handles bulk email sending for "La Granjaus Paid" campaign via CSV using Resend Batch API.
// Deploy with: supabase functions deploy bulk-email-granjaus-csv

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

interface GranjausPaidCsvRequest {
  isTest?: boolean;
  testEmail?: string;
  freeLink: string;
  contacts: { nombre: string; email: string }[];
}

// Template HTML — La Granjaus Paid (dark red, single CTA, no subtitle)
function generateEmailHtml(nombre: string, freeLink: string): string {
  let firstName = "Miembro";
  if (nombre && typeof nombre === 'string') {
    const rawFirst = nombre.trim().split(/\s+/)[0];
    if (rawFirst.length > 1) {
      firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
    } else {
      firstName = rawFirst.toUpperCase();
    }
  }

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <title>La Granjaus - Midnight Club</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: dark only; }
    /* Prevent email client dark mode from inverting colors */
    @media (prefers-color-scheme: dark) {
      .granjaus-title { color: #E5E5E5 !important; }
      .granjaus-body { color: #E8D0D0 !important; }
      .granjaus-desc { color: #AD7A7A !important; }
      .granjaus-footer { color: #D4908F !important; }
      .granjaus-cta { background-color: #E5E5E5 !important; color: #1A0A0A !important; }
      .granjaus-card { background-color: #1A0A0A !important; }
      .granjaus-bg { background-color: #120606 !important; }
    }
    /* Outlook dark mode override */
    [data-ogsc] .granjaus-title { color: #E5E5E5 !important; }
    [data-ogsc] .granjaus-body { color: #E8D0D0 !important; }
    [data-ogsc] .granjaus-desc { color: #AD7A7A !important; }
    [data-ogsc] .granjaus-footer { color: #D4908F !important; }
    [data-ogsc] .granjaus-cta { background-color: #E5E5E5 !important; color: #1A0A0A !important; }
    [data-ogsc] .granjaus-card { background-color: #1A0A0A !important; }
    [data-ogsc] .granjaus-bg { background-color: #120606 !important; }
  </style>
</head>
<body class="granjaus-bg" style="margin: 0; padding: 40px 20px; background-color: #120606 !important; background-image: linear-gradient(#120606, #120606); text-align: center;">
  
  <div class="granjaus-card" style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 500px; margin: 0 auto; background-color: #1A0A0A !important; background-image: linear-gradient(#1A0A0A, #1A0A0A); color: #E5E5E5 !important; padding: 0; border: 1px solid #4A1C1C; border-radius: 8px; overflow: hidden; letter-spacing: -0.01em; text-align: center;">
    
    <!-- Header -->
    <div style="padding: 48px 20px 40px; border-bottom: 1px solid #4A1C1C;">
      <h1 class="granjaus-title" style="color: #E5E5E5 !important; font-size: 28px; margin: 0; letter-spacing: 6px; text-transform: uppercase; font-weight: 700;">LA GRANJAUS</h1>
    </div>
    
    <!-- Body -->
    <div style="padding: 40px 30px 48px;">
      
      <p class="granjaus-body" style="color: #E8D0D0 !important; font-size: 14px; line-height: 1.8; margin: 0 auto 40px; max-width: 380px; font-weight: 400;">
        ¿TE GUSTA LA MÚSICA ELECTRÓNICA? VENÍ ESTE VIERNES A LA GRANJAUS
      </p>
      
      <div style="margin-bottom: 16px;">
        <a class="granjaus-cta" href="${freeLink}" style="display: block; background-color: #E5E5E5 !important; background-image: linear-gradient(#E5E5E5, #E5E5E5); color: #1A0A0A !important; text-decoration: none; padding: 18px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; transition: opacity 0.2s;">
          ANTICIPADAS DISPONIBLES
        </a>
      </div>
      <p class="granjaus-desc" style="color: #AD7A7A !important; font-size: 10px; margin: 0 auto 32px; line-height: 1.5; font-weight: 400; max-width: 300px; text-transform: uppercase; letter-spacing: 1px;">
        RESERVA TU LUGAR. VÁLIDO HASTA LAS 3:00
      </p>

      <hr style="border: 0; border-top: 1px solid #4A1C1C; margin: 0 0 32px;" />
      
      <!-- Footer -->
      <p class="granjaus-footer" style="color: #D4908F !important; font-size: 10px; margin: 0; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">
        MIDNIGHT CLUB EXPERIENCE
      </p>
    </div>
  </div>

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

    const body: GranjausPaidCsvRequest = await req.json();
    const { isTest, testEmail, freeLink, contacts } = body;

    if (!freeLink) {
      return jsonResponse({ error: "Falta el link de la campaña" }, 400);
    }

    // Test mode
    if (isTest) {
      if (!testEmail) {
        return jsonResponse({ error: "Email de prueba requerido" }, 400);
      }

      const html = generateEmailHtml("Test", freeLink);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Midnight Club <noreply@midnightclub.com.ar>",
          to: testEmail,
          subject: "La Granjaus — Midnight Club",
          html: html,
        }),
      });

      const emailResult = await emailResponse.json();
      if (!emailResponse.ok) {
        throw new Error(emailResult.message || "Error al enviar email de prueba");
      }
      return jsonResponse({ success: true, message: "Prueba enviada" });
    }

    // Batch mode
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
            subject: "La Granjaus — Midnight Club",
            html: generateEmailHtml(c.nombre || "Miembro", freeLink)
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
