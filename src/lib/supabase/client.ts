import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase ortam değişkenleri eksik: NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlanmalıdır."
    );
  }

  if (typeof window === "undefined") {
    return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  if (!browserClient) {
    browserClient = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}