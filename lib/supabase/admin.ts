import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only code that needs to bypass RLS or call
 * restricted RPCs (e.g. get_gemini_api_key). Never import this from a
 * Client Component or anything that ships to the browser -- the service
 * role key has full database access.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
