import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Session, UserRole, MemberStatus } from "@/types";
import { ACTIVE_COMPANY_COOKIE } from "./constants";

interface CompanyMemberRow {
  company_id: string;
  role: UserRole;
  status: MemberStatus;
  employee_id: string | null;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
}

export async function resolveActiveCompanyId(
  supabase: SupabaseClient,
  userId: string,
  cookieCompanyId?: string
): Promise<string | null> {
  const { data: memberships, error } = await supabase
    .from("company_members")
    .select("company_id, status")
    .eq("user_id", userId);

  if (error || !memberships?.length) {
    return null;
  }

  const active = memberships.filter((m) => (m.status ?? "active") === "active");
  if (active.length === 0) {
    return memberships[0]?.company_id ?? null;
  }

  if (cookieCompanyId && active.some((m) => m.company_id === cookieCompanyId)) {
    return cookieCompanyId;
  }

  return active[0].company_id;
}

export async function buildAppSession(
  supabase: SupabaseClient,
  authUser: User,
  activeCompanyId?: string | null
): Promise<Session | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("id", authUser.id)
    .maybeSingle<ProfileRow>();

  if (!profile) return null;

  const companyId = await resolveActiveCompanyId(
    supabase,
    authUser.id,
    activeCompanyId ?? undefined
  );

  if (!companyId) {
    return {
      userId: profile.id,
      email: profile.email,
      name: profile.name,
      role: "accountant",
      companyId: "",
      memberStatus: "pending",
    };
  }

  const { data: membership } = await supabase
    .from("company_members")
    .select("role, status, employee_id")
    .eq("user_id", authUser.id)
    .eq("company_id", companyId)
    .maybeSingle<Pick<CompanyMemberRow, "role" | "status" | "employee_id">>();

  return {
    userId: profile.id,
    email: profile.email,
    name: profile.name,
    role: membership?.role ?? "accountant",
    companyId,
    memberStatus: (membership?.status ?? "active") as MemberStatus,
    employeeId: membership?.employee_id ?? undefined,
  };
}

export function readActiveCompanyCookie(cookieValue?: string): string | undefined {
  return cookieValue || undefined;
}

export { ACTIVE_COMPANY_COOKIE };
