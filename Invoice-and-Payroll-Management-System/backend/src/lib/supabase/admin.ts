import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../../config/env.js";

let adminClient: SupabaseClient | null = null;

/** Service-role client — bypasses RLS. Use only in trusted server code. */
export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
  adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
