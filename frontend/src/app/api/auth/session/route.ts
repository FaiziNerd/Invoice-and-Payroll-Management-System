import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/response";
import {
  ACTIVE_COMPANY_COOKIE,
  buildAppSession,
  readActiveCompanyCookie,
} from "@/lib/auth/server-session";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return fail("UNAUTHORIZED", "Not authenticated", 401);
  }

  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const activeCompanyId = readActiveCompanyCookie(
    cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value
  );

  const session = await buildAppSession(supabase, user, activeCompanyId);
  if (!session) {
    return fail("NOT_FOUND", "Profile not found", 404);
  }

  return ok(session);
}
