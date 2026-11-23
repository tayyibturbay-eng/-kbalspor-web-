import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .replace(/['"]/g, "")
  .trim()
  .replace(/\/+$/, "");

const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
  .replace(/['"]/g, "")
  .trim();

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!SUPABASE_URL.startsWith("http") || !SUPABASE_ANON_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalıdır."
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