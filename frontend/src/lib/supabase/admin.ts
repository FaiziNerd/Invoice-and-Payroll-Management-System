import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("Supabase Admin client can only be used on the server side.");
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
