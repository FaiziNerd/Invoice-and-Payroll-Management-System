import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/response";
import { ACTIVE_COMPANY_COOKIE, readActiveCompanyCookie, resolveActiveCompanyId } from "@/lib/auth/server-session";
import { recordAuditLog } from "@/lib/server/record-audit-log";

/** Records a login event using the authenticated session identity (no client-supplied fields). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("UNAUTHORIZED", "Not authenticated", 401);
  }

  const cookieStore = await import("next/headers").then((m) => m.cookies());
  let companyId = readActiveCompanyCookie(cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value);

  if (!companyId) {
    companyId = (await resolveActiveCompanyId(supabase, user.id)) ?? undefined;
  }

  if (!companyId) {
    return ok({ recorded: false });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.name ?? user.email ?? "User";

  await recordAuditLog(supabase, {
    companyId,
    userId: user.id,
    userName,
    action: "login",
    entity: "user",
    entityId: user.id,
    description: `${userName} logged in`,
  });

  return ok({ recorded: true });
}
