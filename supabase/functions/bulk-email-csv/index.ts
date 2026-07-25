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

// Generador del HTML de la plantilla (1 CTA, Blanco)
function generateEmailHtml(nombre: string, freeLink: string): string {
  // Aseguramos capturar única y exclusivamente el PRIMER NOMBRE, y que esté en Title Case
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
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Member Pass - Midnight Club</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: dark; }
  </style>
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #050505; background-image: linear-gradient(#050505, #050505); text-align: center;">
  
  <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 500px; margin: 0 auto; background-color: #0A0A0A; background-image: linear-gradient(#0A0A0A, #0A0A0A); color: #E5E5E5; padding: 0; border: 1px solid #1A1A1A; border-radius: 8px; overflow: hidden; letter-spacing: -0.01em; text-align: center;">
    
    <!-- Header -->
    <div style="padding: 48px 20px 40px; border-bottom: 1px solid #1A1A1A;">
      <h1 style="color: #E5E5E5; font-size: 28px; margin: 0; letter-spacing: 6px; text-transform: uppercase; font-weight: 700;">MIDNIGHT CLUB</h1>
      <p style="color: #737373; margin: 12px 0 0; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; font-weight: 500;">INVITACIÓN EXCLUSIVA ${firstName.toUpperCase()}</p>
    </div>
    
    <!-- Body -->
    <div style="padding: 40px 30px 48px;">
      
      <p style="color: #A3A3A3; font-size: 14px; line-height: 1.8; margin: 0 auto 40px; max-width: 380px; font-weight: 400;">
        Felicidades! Recibiste una invitacion MEMBER FREE PASS para este Sabado! Te esperamos!
      </p>
      
      <div style="margin-bottom: 16px;">
        <a href="${freeLink}" style="display: block; background-color: #E5E5E5; background-image: linear-gradient(#E5E5E5, #E5E5E5); color: #0A0A0A; text-decoration: none; padding: 18px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; transition: opacity 0.2s;">
          OBTENER MEMBER FREE PASS
        </a>
      </div>
      <p style="color: #52525B; font-size: 10px; margin: 0 auto 32px; line-height: 1.5; font-weight: 400; max-width: 300px; text-transform: uppercase; letter-spacing: 1px;">
        VÁLIDO HASTA LAS 2:00. SUJETO A CAPACIDAD.
      </p>

      <hr style="border: 0; border-top: 1px solid #1A1A1A; margin: 0 0 32px;" />
      
      <!-- Footer Notes -->
      <p style="color: #737373; font-size: 10px; margin: 0; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">
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

    const body: BulkEmailCsvRequest = await req.json();
    const { isTest, testEmail, freeLink, contacts } = body;

    if (!freeLink) {
      return jsonResponse({ error: "Falta el link de la campaña" }, 400);
    }

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
