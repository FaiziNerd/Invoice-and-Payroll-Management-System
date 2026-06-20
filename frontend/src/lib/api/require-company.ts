import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api/response";
import {
  ACTIVE_COMPANY_COOKIE,
  readActiveCompanyCookie,
  resolveActiveCompanyId,
} from "@/lib/auth/server-session";
import type { MemberStatus, UserRole } from "@/types";

export type CompanyContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  companyId: string;
  role: UserRole;
  memberStatus: MemberStatus;
  employeeId?: string;
};

export async function requireCompanyContext(options?: {
  roles?: UserRole[];
  allowPending?: boolean;
}): Promise<{ ctx: CompanyContext } | { error: ReturnType<typeof fail> }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: fail("UNAUTHORIZED", "Not authenticated", 401) };
  }

  const cookieStore = await import("next/headers").then((m) => m.cookies());
  let companyId = readActiveCompanyCookie(
    cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value
  );

  if (!companyId) {
    companyId =
      (await resolveActiveCompanyId(supabase, user.id, undefined)) ?? undefined;
  }

  if (!companyId) {
    return { error: fail("VALIDATION_ERROR", "No active company selected", 400) };
  }

  const { data: membership, error } = await supabase
    .from("company_members")
    .select("role, status, employee_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return { error: fail("INTERNAL_ERROR", error.message, 500) };
  }

  if (!membership) {
    return { error: fail("FORBIDDEN", "You are not a member of this company", 403) };
  }

  const memberStatus = (membership.status ?? "active") as MemberStatus;
  if (memberStatus === "pending" && !options?.allowPending) {
    return {
      error: fail(
        "FORBIDDEN",
        "Your account is pending admin approval",
        403
      ),
    };
  }

  const role = membership.role as UserRole;

  if (options?.roles && !options.roles.includes(role)) {
    return { error: fail("FORBIDDEN", "Insufficient permissions", 403) };
  }

  return {
    ctx: {
      supabase,
      user,
      companyId,
      role,
      memberStatus,
      employeeId: membership.employee_id ?? undefined,
    },
  };
}
