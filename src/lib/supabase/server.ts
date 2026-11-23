import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient(accessToken?: string) {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(/['"]/g, "")
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/+$/, "");

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "")
    .replace(/['"]/g, "")
    .trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
    .replace(/['"]/g, "")
    .trim();

  const supabaseKey = serviceKey || anonKey;

  if (!supabaseUrl.startsWith("http") || !supabaseKey) {
    throw new Error(
      `Sunucu Supabase yapılandırması eksik (url=${Boolean(supabaseUrl)}, key=${Boolean(supabaseKey)}).`
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global:
      !serviceKey && accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined,
  });
}