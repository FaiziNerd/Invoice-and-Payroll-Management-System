import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/response";
import { ACTIVE_COMPANY_COOKIE, readActiveCompanyCookie, resolveActiveCompanyId } from "@/lib/auth/server-session";
import { recordAuditLog } from "@/lib/server/record-audit-log";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.name ?? user.email ?? "User";

  if (companyId) {
    await recordAuditLog(supabase, {
      companyId,
      userId: user.id,
      userName,
      action: "logout",
      entity: "user",
      entityId: user.id,
      description: `${userName} logged out`,
    });
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const response = ok({ signedOut: true });
  response.cookies.set(ACTIVE_COMPANY_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
