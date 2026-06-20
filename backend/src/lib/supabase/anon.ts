import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../../config/env.js";

/** Anon client — respects RLS. Pass user JWT when acting on behalf of a user. */
export function createAnonClient(accessToken?: string): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getEnv();

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });

  return client;
}
