import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-less client with the publishable key, for public read-only tables
 * (sp500_esg_*, nz_*). Unlike lib/supabase/server.ts it never touches
 * cookies(), so it works in cached data functions and in tests.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
