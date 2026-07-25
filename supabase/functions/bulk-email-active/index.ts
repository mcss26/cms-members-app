// Supabase Edge Function: bulk-email-active
// Handles bulk email sending for active members using Resend API in batches.
// Deploy with: supabase functions deploy bulk-email-active

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dominios permitidos para CORS (informativo, usando reflexión)
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

interface BulkEmailRequest {
  isTest?: boolean;
  testEmail?: string;
  freeLink: string;
  priorityLink: string;
  last_id?: string;
}

// Generador del HTML de la plantilla
function generateEmailHtml(nombre: string, freeLink: string, priorityLink: string): string {
  const firstName = nombre ? nombre.trim().split(/\s+/)[0] : "Miembro";
  
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
        Todavia estas a tiempo de pedir tu MEMBER PASS. Te esperamos!
      </p>
      
      <div style="margin-bottom: 16px;">
        <a href="${freeLink}" style="display: block; background-color: transparent; border: 1px solid #333333; color: #E5E5E5; text-decoration: none; padding: 18px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; transition: opacity 0.2s;">
          OBTENER MEMBER FREE PASS
        </a>
      </div>
      <p style="color: #52525B; font-size: 10px; margin: 0 auto 32px; line-height: 1.5; font-weight: 400; max-width: 300px; text-transform: uppercase; letter-spacing: 1px;">
        VÁLIDO HASTA LAS 2:00. SUJETO A CAPACIDAD.
      </p>

      <div style="margin-bottom: 16px;">
        <a href="${priorityLink}" style="display: block; background-color: #E5E5E5; background-image: linear-gradient(#E5E5E5, #E5E5E5); color: #0A0A0A; text-decoration: none; padding: 18px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; transition: opacity 0.2s;">
          COMPRAR PRIORITY PASS ($10.000)
        </a>
      </div>
      <p style="color: #52525B; font-size: 10px; margin: 0 auto 32px; line-height: 1.5; font-weight: 400; max-width: 300px; text-transform: uppercase; letter-spacing: 1px;">
        RESERVA TU LUGAR. VÁLIDO HASTA LAS 3:00 CON ACCESO RÁPIDO (GREENLINE).
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

    const body: BulkEmailRequest = await req.json();
    const { isTest, testEmail, freeLink, priorityLink, last_id } = body;

    if (!freeLink || !priorityLink) {
      return jsonResponse({ error: "Faltan los links de la campaña" }, 400);
    }

    // Flujo MODO PRUEBA
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
          subject: "Invitación Exclusiva - Midnight Club",
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

    // Flujo MODO REAL (Batch)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startId = last_id || '00000000-0000-0000-0000-000000000000';

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: members, error } = await supabase
      .from("members")
      .select("id, nombre, email")
      .eq("status", "active")
      .not("email", "is", null)
      .not("email", "eq", "")
      .or(`last_campaign_sent_at.is.null,last_campaign_sent_at.lt.${yesterday}`)
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

    // Filtrar emails inválidos antes de enviar a Resend
    const validMembers = members.filter(m => {
      const email = typeof m.email === 'string' ? m.email.trim() : "";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    });

    const emailsPayload = validMembers.map(m => {
      return {
        from: "Midnight Club <noreply@midnightclub.com.ar>",
        to: m.email.trim(),
        subject: "Invitación Exclusiva - Midnight Club",
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

    // Marcar como enviado en la base de datos para evitar duplicados
    const memberIds = members.map(m => m.id);
    const { error: updateError } = await supabase
      .from("members")
      .update({ last_campaign_sent_at: new Date().toISOString() })
      .in('id', memberIds);

    if (updateError) {
      console.error("Error actualizando timestamps:", updateError.message);
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
    console.error("Bulk Email Error:", err);
    return jsonResponse({
      error: "Error interno del servidor",
      details: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});
