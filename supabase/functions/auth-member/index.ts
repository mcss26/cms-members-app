// Supabase Edge Function: auth-member
// Handles member authentication with secure password hashing
// Deploy with: supabase functions deploy auth-member

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

// Dominios permitidos para CORS (informativo, ahora usamos reflexión dinámica)
const ALLOWED_ORIGINS = [
  "https://midnightclub.com.ar",
  "https://www.midnightclub.com.ar",
  "https://mcss26.github.io"
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  // Reflejar el origen de la petición, o permitir todo si no hay origen (ej. file://)
  const allowedOrigin = origin ? origin : "*";
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// JWT secret - MUST be set in Supabase secrets (no fallback)
const JWT_SECRET = Deno.env.get("MEMBER_JWT_SECRET");
if (!JWT_SECRET || JWT_SECRET === "change-this-in-production") {
  throw new Error("CRITICAL: MEMBER_JWT_SECRET not configured in environment variables");
}
const JWT_EXPIRY_HOURS = 24;

// Rate limiting config
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = loginAttempts.get(identifier);
  
  // Limpiar registros expirados
  if (record && now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(identifier);
  }
  
  const current = loginAttempts.get(identifier);
  
  if (!current) {
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  const remaining = MAX_LOGIN_ATTEMPTS - current.count;
  const resetIn = RATE_LIMIT_WINDOW_MS - (now - current.firstAttempt);
  
  return { 
    allowed: current.count < MAX_LOGIN_ATTEMPTS, 
    remaining: Math.max(0, remaining - 1),
    resetIn: Math.max(0, resetIn)
  };
}

function recordLoginAttempt(identifier: string): void {
  const now = Date.now();
  const record = loginAttempts.get(identifier);
  
  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(identifier, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function clearLoginAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

interface LoginRequest {
  action: "login" | "register" | "recovery" | "validate" | "change-password" | "approve";
  member_id?: string;
  id?: string;  // UUID del miembro (para approve sin member_id)
  password?: string;
  email?: string;
  token?: string;
  new_password?: string;
  user_data?: {
    nombre: string;
    email: string;
    telefono: string;
    fecha_nacimiento: string;
  };
}

interface AuditLogEntry {
  action: "login" | "login_failed" | "recovery" | "password_change" | "session_validate" | "approve" | "approve_email_failed";
  member_id?: string;
  member_uuid?: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  // Extraer info de request para audit log
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Helper para respuestas JSON con CORS
  const jsonResponse = (data: unknown, status = 200) => 
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Función de audit logging (no bloquea respuesta)
    const logAudit = async (entry: AuditLogEntry) => {
      try {
        await supabase.from("auth_audit_log").insert({
          action: entry.action,
          member_id: entry.member_id,
          member_uuid: entry.member_uuid,
          ip_address: clientIP,
          user_agent: userAgent,
          success: entry.success,
          error_message: entry.error_message,
          metadata: entry.metadata || {},
        });
      } catch (e) {
        console.error("Audit log error:", e);
      }
    };

    const body: LoginRequest = await req.json();
    const { action } = body;


    // Generate JWT key for signing
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    switch (action) {
      case "login": {
        const { member_id, password } = body;
        if (!member_id || !password) {
          return jsonResponse({ error: "ID y contraseña requeridos" }, 400);
        }

        // Rate limiting por IP + member_id
        const rateLimitKey = `${clientIP}:${member_id.toUpperCase()}`;
        
        const rateCheck = checkRateLimit(rateLimitKey);
        if (!rateCheck.allowed) {
          const resetMinutes = Math.ceil(rateCheck.resetIn / 60000);
          return jsonResponse({ 
            error: `Demasiados intentos. Reintenta en ${resetMinutes} minutos.`,
            retry_after: rateCheck.resetIn 
          }, 429);
        }

        // Fetch member by ID (incluir access_password para migración)
        const { data: member, error } = await supabase
          .from("members")
          .select("id, member_id, nombre, email, access_password_hash, access_password, status")
          .eq("member_id", member_id.toUpperCase())
          .single();

        console.log(`🔍 Login attempt for ${member_id}:`, {
          found: !!member,
          error: error?.message,
          status: member?.status,
          has_hash: !!member?.access_password_hash,
          has_plain: !!member?.access_password
        });

        if (error || !member) {
          recordLoginAttempt(rateLimitKey);
          logAudit({ action: "login_failed", member_id: member_id.toUpperCase(), success: false, error_message: "Member not found" });
          return jsonResponse({ error: "Credenciales incorrectas" }, 401);
        }

        if (member.status !== "active") {
          console.log(`❌ Status inválido: "${member.status}" !== "active"`);
          return jsonResponse({ error: "Cuenta no activa" }, 401);
        }

        let passwordValid = false;
        let needsMigration = false;

        // OPCIÓN 1: Validar contra hash bcrypt (nuevo sistema)
        if (member.access_password_hash) {
          try {
            passwordValid = bcrypt.compareSync(
              password.toUpperCase(),
              member.access_password_hash
            );
          } catch (e) {
            // Hash no es bcrypt válido, probablemente pgcrypto legacy
            console.log("Hash no es bcrypt válido, intentando migración");
          }
        }

        // OPCIÓN 2: Fallback a plaintext (migración legacy)
        if (!passwordValid && member.access_password) {
          if (password.toUpperCase() === member.access_password.toUpperCase()) {
            passwordValid = true;
            needsMigration = true;
            console.log(`Miembro ${member.member_id} necesita migración a bcrypt`);
          }
        }

        if (!passwordValid) {
          recordLoginAttempt(rateLimitKey);
          logAudit({ action: "login_failed", member_id: member.member_id, member_uuid: member.id, success: false, error_message: "Invalid password" });
          return jsonResponse({ error: "Credenciales incorrectas" }, 401);
        }

        // MIGRACIÓN AUTOMÁTICA: Si login exitoso con plaintext, rehashear con bcrypt
        if (needsMigration) {
          try {
            const passwordToHash = String(password.toUpperCase());
            console.log(`Migrando miembro ${member.member_id}, password length: ${passwordToHash.length}`);
            const newHash = bcrypt.hashSync(passwordToHash);
            await supabase
              .from("members")
              .update({
                access_password_hash: newHash,
                access_password: null  // Limpiar plaintext después de migrar
              })
              .eq("id", member.id);
            console.log(`Miembro ${member.member_id} migrado a bcrypt exitosamente`);
          } catch (hashError) {
            console.error(`Error al migrar ${member.member_id}:`, hashError);
            // No fallar el login si la migración falla
          }
        }

        // Login exitoso: limpiar intentos y loguear
        clearLoginAttempts(rateLimitKey);
        logAudit({ action: "login", member_id: member.member_id, member_uuid: member.id, success: true });

        // Generate JWT token
        const token = await create(
          { alg: "HS256", typ: "JWT" },
          {
            sub: member.id,
            member_id: member.member_id,
            nombre: member.nombre,
            exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_HOURS * 60 * 60,
            iat: Math.floor(Date.now() / 1000),
          },
          key,
        );

        return jsonResponse({
          success: true,
          token,
          member: {
            id: member.id,
            member_id: member.member_id,
            nombre: member.nombre,
            email: member.email,
          },
        });
      }

      case "validate": {
        const { token } = body;
        if (!token) {
          return jsonResponse({ valid: false, error: "Token requerido" }, 400);
        }

        try {
          const payload = await verify(token, key);

          // Check if member still exists and is active
          const { data: member } = await supabase
            .from("members")
            .select("id, member_id, nombre, email, status")
            .eq("id", payload.sub)
            .single();

          if (!member || member.status !== "active") {
            return jsonResponse(
              { valid: false, error: "Sesión inválida" },
              401,
            );
          }

          return jsonResponse({
            valid: true,
            member: {
              id: member.id,
              member_id: member.member_id,
              nombre: member.nombre,
              email: member.email,
            },
          });
        } catch {
          return jsonResponse(
            { valid: false, error: "Token expirado o inválido" },
            401,
          );
        }
      }

      case "recovery": {
        const { email } = body;
        if (!email) {
          return jsonResponse({ error: "Email requerido" }, 400);
        }

        // Rate limiting para recovery (más estricto: 3 intentos)
        const recoveryIP = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
        const rateLimitKey = `recovery:${recoveryIP}`;
        
        const rateCheck = checkRateLimit(rateLimitKey);
        // Solo permitir 3 intentos de recovery
        if (rateCheck.remaining < MAX_LOGIN_ATTEMPTS - 3) {
          const resetMinutes = Math.ceil(rateCheck.resetIn / 60000);
          return jsonResponse({ 
            error: `Demasiados intentos. Reintenta en ${resetMinutes} minutos.`,
            retry_after: rateCheck.resetIn 
          }, 429);
        }
        recordLoginAttempt(rateLimitKey);

        // Always return success to prevent enumeration
        const successResponse = {
          success: true,
          message: "Si el email existe, recibirás instrucciones",
        };

        const { data: member } = await supabase
          .from("members")
          .select("id, nombre, member_id, email")
          .eq("email", email.toLowerCase())
          .single();

        if (!member) {
          // Return same response to prevent enumeration
          return jsonResponse(successResponse);
        }

        // Generate new password and hash it
        const newPassword = generateSecurePassword();
        const hashedPassword = bcrypt.hashSync(newPassword);

        // CRITICAL FIX: Send email FIRST, only update password if email succeeds
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
          console.error("RESEND_API_KEY not configured - cannot send recovery email");
          logAudit({ action: "recovery", member_id: member.member_id, member_uuid: member.id, success: false, error_message: "RESEND_API_KEY not configured" });
          return jsonResponse({ error: "Servicio de email no disponible. Contacta al club." }, 503);
        }

        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Midnight Club <noreply@midnightclub.com.ar>",
              to: [member.email],
              subject: "Recuperación de Contraseña - Midnight Club",
              html: `
  <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 500px; margin: 0 auto; background-color: #0A0A0A; color: #E5E5E5; padding: 0; border: 1px solid #1A1A1A; border-radius: 8px; overflow: hidden; letter-spacing: -0.01em; text-align: center;">
    
    <!-- Header -->
    <div style="padding: 48px 20px 40px; border-bottom: 1px solid #1A1A1A;">
      <h1 style="color: #E5E5E5; font-size: 28px; margin: 0; letter-spacing: 6px; text-transform: uppercase; font-weight: 700;">MIDNIGHT CLUB</h1>
      <p style="color: #737373; margin: 12px 0 0; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; font-weight: 500;">RECUPERACIÓN DE ACCESO</p>
    </div>
    
    <!-- Body -->
    <div style="padding: 40px 30px 48px;">
      
      <p style="color: #A3A3A3; font-size: 14px; line-height: 1.8; margin: 0 auto 40px; max-width: 380px; font-weight: 400;">
        Recibimos una solicitud para recuperar tu acceso a Midnight Club Members. Ingresá usando las siguientes credenciales temporales.
      </p>
      
      <!-- Credenciales -->
      <div style="background-color: #111111; border: 1px solid #1A1A1A; padding: 32px 20px; margin: 0 auto 40px; border-radius: 8px;">
        <p style="margin: 0 0 12px; font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">ID DE MIEMBRO</p>
        <p style="margin: 0 0 32px; font-size: 24px; font-weight: 700; letter-spacing: 3px; color: #E5E5E5;">${member.member_id}</p>
        
        <p style="margin: 0 0 12px; font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">NUEVA CONTRASEÑA</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #E5E5E5;">${newPassword}</p>
      </div>
      
      <!-- Call to Action -->
      <div style="margin-bottom: 40px;">
        <a href="https://midnightclub.com.ar" style="display: block; background-color: #E5E5E5; color: #0A0A0A; text-decoration: none; padding: 18px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; transition: opacity 0.2s;">
          INGRESAR AHORA
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #1A1A1A; margin: 0 0 32px;" />
      
      <!-- Footer Notes -->
      <p style="color: #52525B; font-size: 11px; margin: 0 auto 16px; line-height: 1.5; font-weight: 400; max-width: 300px;">
        * Te recomendamos cambiar esta contraseña desde tu perfil una vez inicies sesión. Si no solicitaste este cambio, ignorá este mensaje.
      </p>
      <p style="color: #737373; font-size: 10px; margin: 0; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">
        MIDNIGHT CLUB EXPERIENCE
      </p>
    </div>
  </div>
              `,
            }),
          });

          const emailResult = await emailResponse.json();

          if (!emailResponse.ok) {
            console.error("Resend API error on recovery:", emailResult);
            logAudit({ action: "recovery", member_id: member.member_id, member_uuid: member.id, success: false, error_message: `Email failed: ${emailResult.message || emailResponse.status}` });
            // Do NOT update password if email failed
            return jsonResponse({ error: "No se pudo enviar el email. Intentá de nuevo más tarde." }, 503);
          }

          // Email sent successfully → NOW update password
          await supabase
            .from("members")
            .update({ access_password_hash: hashedPassword })
            .eq("id", member.id);

          console.log(`Recovery email sent to ${member.email} for ${member.member_id}`);
        } catch (emailError) {
          console.error("Recovery email error:", emailError);
          logAudit({ action: "recovery", member_id: member.member_id, member_uuid: member.id, success: false, error_message: String(emailError) });
          // Do NOT update password if email failed
          return jsonResponse({ error: "Error de conexión al enviar email. Intentá de nuevo." }, 503);
        }

        // Loguear recovery exitoso
        logAudit({ action: "recovery", member_id: member.member_id, member_uuid: member.id, success: true });

        return jsonResponse(successResponse);
      }

      case "change-password": {
        const { token, password, new_password } = body;
        if (!token || !password || !new_password) {
          return jsonResponse({ error: "Datos incompletos" }, 400);
        }

        try {
          const payload = await verify(token, key);

          // Get current member (incluir access_password para migración)
          const { data: member } = await supabase
            .from("members")
            .select("id, access_password_hash, access_password")
            .eq("id", payload.sub)
            .single();

          if (!member) {
            return jsonResponse({ error: "Usuario no encontrado" }, 404);
          }

          // Verify current password (con fallback a plaintext)
          let currentValid = false;

          if (member.access_password_hash) {
            try {
              currentValid = bcrypt.compareSync(
                password.toUpperCase(),
                member.access_password_hash,
              );
            } catch (e) {
              // Hash no es bcrypt válido
            }
          }

          // Fallback a plaintext
          if (!currentValid && member.access_password) {
            currentValid = password.toUpperCase() === member.access_password.toUpperCase();
          }

          if (!currentValid) {
            return jsonResponse({ error: "Contraseña actual incorrecta" }, 401);
          }

          // Hash and save new password (y limpiar plaintext)
          const passwordToHash = String(new_password.toUpperCase());
          const newHash = bcrypt.hashSync(passwordToHash);
          await supabase
            .from("members")
            .update({
              access_password_hash: newHash,
              access_password: null  // Limpiar plaintext
            })
            .eq("id", member.id);

          // Loguear cambio de password exitoso
          logAudit({ action: "password_change", member_uuid: member.id, success: true });

          return jsonResponse({
            success: true,
            message: "Contraseña actualizada",
          });
        } catch {
          return jsonResponse({ error: "Sesión inválida" }, 401);
        }
      }

      case "approve": {
        const { member_id, id, email } = body;
        if (!member_id && !id && !email) {
          return jsonResponse({ error: "Se requiere member_id, id o email" }, 400);
        }

        // Get member by member_id, id (UUID), or email
        let query = supabase
          .from("members")
          .select("id, nombre, email, member_id, status");

        if (member_id) {
          query = query.eq("member_id", member_id.toUpperCase());
        } else if (id) {
          query = query.eq("id", id);
        } else if (email) {
          query = query.eq("email", email.toLowerCase());
        }

        const { data: member, error: memberError } = await query.single();

        if (memberError || !member) {
          console.error("Error buscando miembro:", memberError);
          return jsonResponse({ error: "Miembro no encontrado" }, 404);
        }

        // Generate member_id if not exists
        let finalMemberId = member.member_id;
        if (!finalMemberId) {
          // Generate unique member_id
          let attempts = 0;
          while (attempts < 10) {
            const candidateId = generateMemberId();
            const { data: existing } = await supabase
              .from("members")
              .select("id")
              .eq("member_id", candidateId)
              .single();

            if (!existing) {
              finalMemberId = candidateId;
              break;
            }
            attempts++;
          }

          if (!finalMemberId) {
            return jsonResponse({ error: "No se pudo generar member_id único" }, 500);
          }
        }

        console.log(`Aprobando miembro: ${finalMemberId} (${member.email})`);

        // Generate new password
        const newPassword = generateSecurePassword();
        console.log(`Password generada, length: ${newPassword.length}`);
        const hashedPassword = bcrypt.hashSync(newPassword);
        console.log(`Password hasheada exitosamente`);

        // Update member status, password hash, and member_id if generated
        await supabase
          .from("members")
          .update({
            member_id: finalMemberId,
            access_password_hash: hashedPassword,
            status: "active"
          })
          .eq("id", member.id);

        // Send email via Resend
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) {
          console.error("RESEND_API_KEY not configured");
          return jsonResponse({
            success: false,
            error: "Email service not configured"
          }, 500);
        }

        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Midnight Club <noreply@midnightclub.com.ar>",
              to: member.email,
              subject: "¡Bienvenido a Midnight Club!",
              html: `
  <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 500px; margin: 0 auto; background-color: #0A0A0A; color: #E5E5E5; padding: 0; border: 1px solid #1A1A1A; border-radius: 8px; overflow: hidden; letter-spacing: -0.01em; text-align: center;">
    
    <!-- Header -->
    <div style="padding: 48px 20px 40px; border-bottom: 1px solid #1A1A1A;">
      <h1 style="color: #E5E5E5; font-size: 28px; margin: 0; letter-spacing: 6px; text-transform: uppercase; font-weight: 700;">MIDNIGHT CLUB</h1>
      <p style="color: #737373; margin: 12px 0 0; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; font-weight: 500;">MEMBERS</p>
    </div>
    
    <!-- Body -->
    <div style="padding: 40px 30px 48px;">
      
      <p style="color: #A3A3A3; font-size: 14px; line-height: 1.8; margin: 0 auto 40px; max-width: 380px; font-weight: 400;">
        Ya sos parte de Midnight Club Members. Ingresá usando las siguientes credenciales para acceder a beneficios exclusivos.
      </p>
      
      <!-- Credenciales -->
      <div style="background-color: #111111; border: 1px solid #1A1A1A; padding: 32px 20px; margin: 0 auto 40px; border-radius: 8px;">
        <p style="margin: 0 0 12px; font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">ID DE MIEMBRO</p>
        <p style="margin: 0 0 32px; font-size: 24px; font-weight: 700; letter-spacing: 3px; color: #E5E5E5;">${finalMemberId}</p>
        
        <p style="margin: 0 0 12px; font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">CONTRASEÑA TEMPORAL</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #E5E5E5;">${newPassword}</p>
      </div>
      
      <!-- Call to Action -->
      <div style="margin-bottom: 40px;">
        <a href="https://midnightclub.com.ar" style="display: block; background-color: #E5E5E5; color: #0A0A0A; text-decoration: none; padding: 18px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border-radius: 8px; transition: opacity 0.2s;">
          INGRESAR AHORA
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #1A1A1A; margin: 0 0 32px;" />
      
      <!-- Footer Notes -->
      <p style="color: #52525B; font-size: 11px; margin: 0 auto 16px; line-height: 1.5; font-weight: 400; max-width: 300px;">
        * Te recomendamos cambiar esta contraseña desde tu perfil una vez inicies sesión.
      </p>
      <p style="color: #737373; font-size: 10px; margin: 0; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">
        MIDNIGHT CLUB EXPERIENCE
      </p>
    </div>
  </div>
              `,
            }),
          });

          const emailResult = await emailResponse.json();

          if (!emailResponse.ok) {
            console.error("Resend API error:", emailResult);
            logAudit({
              action: "approve_email_failed",
              member_id: finalMemberId,
              member_uuid: member.id,
              success: false,
              error_message: emailResult.message || "Email send failed"
            });
            return jsonResponse({
              success: true,
              warning: "Miembro aprobado pero email falló",
              credentials: { member_id: finalMemberId, password: newPassword }
            });
          }

          logAudit({
            action: "approve",
            member_id: finalMemberId,
            member_uuid: member.id,
            success: true
          });

          return jsonResponse({
            success: true,
            message: "Miembro aprobado y email enviado",
            credentials: { member_id: finalMemberId, password: newPassword }
          });
        } catch (emailError) {
          console.error("Email send error:", emailError);
          logAudit({
            action: "approve_email_failed",
            member_id: finalMemberId,
            member_uuid: member.id,
            success: false,
            error_message: String(emailError)
          });
          return jsonResponse({
            success: true,
            warning: "Miembro aprobado pero email falló",
            credentials: { member_id: finalMemberId, password: newPassword }
          });
        }
      }

      default:
        return jsonResponse({ error: "Acción no válida" }, 400);
    }
  } catch (err) {
    console.error("❌ CRITICAL ERROR:", err);
    console.error("Error stack:", err instanceof Error ? err.stack : "No stack");
    console.error("Error message:", err instanceof Error ? err.message : String(err));
    return jsonResponse({
      error: "Error interno del servidor",
      details: err instanceof Error ? err.message : String(err)
    }, 500);
  }
});

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (const byte of array) {
    password += chars[byte % chars.length];
  }
  return password;
}

function generateMemberId(): string {
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  const num = ((array[0] << 24) | (array[1] << 16) | (array[2] << 8) | array[3]) >>> 0;
  const fiveDigits = (num % 90000) + 10000; // 10000-99999
  return `MC-${fiveDigits}`;
}