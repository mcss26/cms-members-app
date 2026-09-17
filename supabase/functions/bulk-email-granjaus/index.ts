// Supabase Edge Function: bulk-email-granjaus
// Handles bulk email sending for "La Granjaus" event campaign using Resend API.
// Independent from ACTIVE MEMBERS — does NOT use last_campaign_sent_at filter.
// Deploy with: supabase functions deploy bulk-email-granjaus

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface GranjausEmailRequest {
  isTest?: boolean;
  testEmail?: string;
  freeLink: string;
  priorityLink: string;
  last_id?: string;
}

// Template HTML — La Granjaus (dark red, approved design)
function generateEmailHtml(nombre: string, freeLink: string, priorityLink: string): string {
  const firstName = nombre ? nombre.trim().split(/\s+/)[0] : "Miembro";

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
    @media (prefers-color-scheme: dark) {
      .granjaus-title { color: #E5E5E5 !important; }
      .granjaus-subtitle { color: #D4908F !important; }
      .granjaus-body { color: #E8D0D0 !important; }
      .granjaus-desc { color: #AD7A7A !important; }
      .granjaus-footer { color: #D4908F !important; }
      .granjaus-cta-outline { color: #E5E5E5 !important; border-color: #8B4545 !important; }
      .granjaus-cta-solid { background-color: #E5E5E5 !important; color: #1A0A0A !important; }
      .granjaus-card { background-color: #1A0A0A !important; }
      .granjaus-bg { background-color: #120606 !important; }
    }
    [data-ogsc] .granjaus-title { color: #E5E5E5 !important; }
    [data-ogsc] .granjaus-subtitle { color: #D4908F !important; }
    [data-ogsc] .granjaus-body { color: #E8D0D0 !important; }
    [data-ogsc] .granjaus-desc { color: #AD7A7A !important; }
    [data-ogsc] .granjaus-footer { color: #D4908F !important; }
    [data-ogsc] .granjaus-cta-outline { color: #E5E5E5 !important; border-color: #8B4545 !important; }
    [data-ogsc] .granjaus-cta-solid { background-color: #E5E5E5 !important; color: #1A0A0A !important; }
    [data-ogsc] .granjaus-card { background-color: #1A0A0A !important; }
    [data-ogsc] .granjaus-bg { background-color: #120606 !important; }
  </style>
</head>
<body class="granjaus-bg" style="margin: 0; padding: 40px 20px; background-color: #120606 !important; background-image: linear-gradient(#120606, #120606); text-align: center;">
  
  <div class="granjaus-card" style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 500px; margin: 0 auto; background-color: #1A0A0A !important; background-image: linear-gradient(#1A0A0A, #1A0A0A); color: #E5E5E5 !important; padding: 0; border: 1px solid #4A1C1C; border-radius: 8px; overflow: hidden; letter-spacing: -0.01em; text-align: center;">
    
    <!-- Header -->
    <div style="padding: 48px 20px 40px; border-bottom: 1px solid #4A1C1C;">
      <h1 class="granjaus-title" style="color: #E5E5E5 !important; font-size: 28px; margin: 0; letter-spacing: 6px; text-transform: uppercase; font-weight: 700;">LA GRANJAUS</h1>
      <p class="granjaus-subtitle" style="color: #D4908F !important; margin: 12px 0 0; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; font-weight: 500;">INVITACIÓN EXCLUSIVA ${firstName.toUpperCase()}</p>
    </div>
    
    <!-- Body -->
    <div style="padding: 40px 30px 48px;">
      
      <p class="granjaus-body" style="color: #E8D0D0 !important; font-size: 14px; line-height: 1.8; margin: 0 auto 40px; max-width: 380px; font-weight: 400;">
        ¿TE GUSTA LA MÚSICA ELECTRÓNICA? TE INVITAMOS ESTE VIERNES A LA PRIMERA FECHA DE LA GRANJAUS AL AIRE LIBRE EN MIDNIGHT
      </p>
      
      <div style="margin-bottom: 16px;">
        <a class="granjaus-cta-outline" href="${freeLink}" style="display: block; background-color: transparent; border: 1px solid #8B4545; color: #E5E5E5 !important; text-decoration: none; padding: 18px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; transition: opacity 0.2s;">
          OBTENER INVITACIÓN
        </a>
      </div>
      <p class="granjaus-desc" style="color: #AD7A7A !important; font-size: 10px; margin: 0 auto 32px; line-height: 1.5; font-weight: 400; max-width: 300px; text-transform: uppercase; letter-spacing: 1px;">
        VÁLIDO HASTA LAS 2:00. SUJETO A CAPACIDAD.
      </p>

      <div style="margin-bottom: 16px;">
        <a class="granjaus-cta-solid" href="${priorityLink}" style="display: block; background-color: #E5E5E5 !important; background-image: linear-gradient(#E5E5E5, #E5E5E5); color: #1A0A0A !important; text-decoration: none; padding: 18px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; transition: opacity 0.2s;">
          COMPRAR ACCESO ($10.000)
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

    const body: GranjausEmailRequest = await req.json();
    const { isTest, testEmail, freeLink, priorityLink, last_id } = body;

    if (!freeLink || !priorityLink) {
      return jsonResponse({ error: "Faltan los links de la campaña" }, 400);
    }

    // Test mode
    if (isTest) {
      if (!testEmail) {
        return jsonResponse({ error: "Email de prueba requerido" }, 400);
      }

      const html = generateEmailHtml("Test", freeLink, priorityLink);

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

      return jsonResponse({
        success: true,
        message: "Email de prueba enviado",
        sentCount: 1,
        next_last_id: null
      });
    }

    // Real mode (Batch) — No last_campaign_sent_at filter (independent campaign)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startId = last_id || '00000000-0000-0000-0000-000000000000';

    const { data: members, error } = await supabase
      .from("members")
      .select("id, nombre, email")
      .eq("status", "active")
      .not("email", "is", null)
      .not("email", "eq", "")
      .gt("id", startId)
      .order("id", { ascending: true })
      .limit(100);

    if (error) {
      throw new Error(`Error en base de datos: ${error.message}`);
    }

    if (!members || members.length === 0) {
      return jsonResponse({
        success: true,
        message: "No hay más miembros por procesar",
        sentCount: 0,
        next_last_id: null
      });
    }

    // Filter invalid emails before sending to Resend
    const validMembers = members.filter(m => {
      const email = typeof m.email === 'string' ? m.email.trim() : "";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    });

    const emailsPayload = validMembers.map(m => {
      return {
        from: "Midnight Club <noreply@midnightclub.com.ar>",
        to: m.email.trim(),
        subject: "La Granjaus — Midnight Club",
        html: generateEmailHtml(m.nombre, freeLink, priorityLink),
      };
    });

    let sentCount = 0;
    if (emailsPayload.length > 0) {
      const batchResponse = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailsPayload),
      });
      const batchResult = await batchResponse.json();
      if (!batchResponse.ok) {
        throw new Error(batchResult.message || "Error en el Batch de Resend");
      }
      sentCount = emailsPayload.length;
    }

    const nextLastId = members[members.length - 1].id;

    return jsonResponse({
      success: true,
      message: `Procesados ${members.length}, Enviados ${sentCount} correos`,
      sentCount: sentCount,
      processedCount: members.length,
      next_last_id: nextLastId
    });

  } catch (err) {
    console.error("Granjaus Email Error:", err);
    return jsonResponse({
      error: "Error interno del servidor",
      details: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});
