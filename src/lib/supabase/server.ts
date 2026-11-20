import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://aimaeqouwsyftwtjdtoo.supabase.co";
const FALLBACK_KEY = "sb_publishable_rV2Gq89vqhvDLCEpyUXwEg_3JaZteJU";

export function createServerSupabaseClient() {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(/['"]/g, "")
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/+$/, "");

  const rawKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  )
    .replace(/['"]/g, "")
    .trim();

  const supabaseUrl = rawUrl.startsWith("http") ? rawUrl : FALLBACK_URL;
  const supabaseKey = rawKey.length > 20 ? rawKey : FALLBACK_KEY;

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}