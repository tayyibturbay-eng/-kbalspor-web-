import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const SUPABASE_URL =
  envUrl && envUrl.startsWith("http")
    ? envUrl
    : "https://aimaeqouwsyftwtjdtoo.supabase.co";

const SUPABASE_KEY =
  envKey && envKey.length > 20
    ? envKey
    : "sb_publishable_rV2Gq89vqhvDLCEpyUXwEg_3JaZteJU";

export function createClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
}