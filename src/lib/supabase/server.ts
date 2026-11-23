import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function createServerSupabaseClient(useServiceRole = true): SupabaseClient {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(/['"]/g, "")
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/+$/, "");

  const key = useServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const cleanKey = (key || "").replace(/['"]/g, "").trim();

  if (!supabaseUrl.startsWith("http") || cleanKey.length < 20) {
    throw new Error("Sunucu Supabase yapılandırması geçersiz veya eksik.");
  }

  return createClient(supabaseUrl, cleanKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}