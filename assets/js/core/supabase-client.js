/**
 * @fileoverview Supabase Client Initialization.
 * Loads window.sb using window.APP_CONFIG and window.supabase.
 */
(function () {
  if (window.sb) return;

  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error("[supabase-client] Falta APP_CONFIG (SUPABASE_URL / SUPABASE_ANON_KEY).");
    return;
  }

  const lib = window.supabase;
  if (!lib || typeof lib.createClient !== "function") {
    // Retry once or just fail gracefully?
    // Given 'defer' usage, it SHOULD be here. If not, it's a critical load error.
    console.error("[supabase-client] CRITICAL: window.supabase not found. Ensure SDK is loaded before this script.");
    return;
  }

  window.sb = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
})();
