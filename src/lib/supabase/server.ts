import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(/['"]/g, "")
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/+$/, "");

  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  )
    .replace(/['"]/g, "")
    .trim();

  if (!supabaseUrl.startsWith("http") || !supabaseKey) {
    throw new Error(
      `Sunucu Supabase yapılandırması eksik (url=${Boolean(supabaseUrl)}, key=${Boolean(supabaseKey)}).`
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}