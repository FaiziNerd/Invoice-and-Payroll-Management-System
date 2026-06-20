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
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("UNAUTHORIZED", "Not authenticated", 401);
  }

  const { data: memberships, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id);

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const companyIds = (memberships ?? []).map((m) => m.company_id);
  if (companyIds.length === 0) {
    return ok({ companies: [], activeCompanyId: null });
  }

  const { data: companyRows, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, slug, created_at")
    .in("id", companyIds);

  if (companiesError) {
    return fail("INTERNAL_ERROR", companiesError.message, 500);
  }

  const roleByCompany = new Map(
    (memberships ?? []).map((m) => [m.company_id, m.role])
  );

  const companies = (companyRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    createdAt: c.created_at,
    role: roleByCompany.get(c.id),
  }));

  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const activeCompanyId = readActiveCompanyCookie(
    cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value
  );

  return ok({
    companies,
    activeCompanyId: activeCompanyId ?? companies[0]?.id ?? null,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("UNAUTHORIZED", "Not authenticated", 401);
  }

  let companyId: string;
  try {
    const body = (await request.json()) as { companyId?: string };
    if (!body.companyId) {
      return fail("VALIDATION_ERROR", "companyId is required", 400);
    }
    companyId = body.companyId;
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const { data: membership, error: memberError } = await supabase
    .from("company_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (memberError) {
    return fail("INTERNAL_ERROR", memberError.message, 500);
  }
  if (!membership) {
    return fail("FORBIDDEN", "You are not a member of this company", 403);
  }

  const session = await buildAppSession(supabase, user, companyId);
  if (!session) {
    return fail("INTERNAL_ERROR", "Failed to build session", 500);
  }

  const response = ok(session);
  response.cookies.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
