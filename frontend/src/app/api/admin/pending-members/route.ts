import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { recordAuditLog } from "@/lib/server/record-audit-log";
import { z } from "zod";

const ADMIN_ROLES = ["admin"] as const;

const approveSchema = z.object({
  userId: z.string().uuid(),
});

export async function GET() {
  const result = await requireCompanyContext({ roles: [...ADMIN_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("company_members")
    .select("id, user_id, role, status, created_at, profiles(name, email)")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return fail("INTERNAL_ERROR", error.message, 500);

  const pending = (data ?? []).map((row) => {
    const profileRaw = row.profiles as
      | { name: string; email: string }
      | { name: string; email: string }[]
      | null;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    return {
      id: row.id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      name: profile?.name ?? "Unknown",
      email: profile?.email ?? "",
      createdAt: row.created_at,
    };
  });

  return ok(pending);
}

export async function POST(request: Request) {
  const result = await requireCompanyContext({ roles: [...ADMIN_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data, error } = await supabase
    .from("company_members")
    .update({ status: "active" })
    .eq("company_id", companyId)
    .eq("user_id", parsed.data.userId)
    .eq("status", "pending")
    .select("id, user_id, role")
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Pending member not found", 404);

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: approvedProfile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  await recordAuditLog(supabase, {
    companyId,
    userId: user.id,
    userName: profile?.name ?? "Admin",
    action: "update",
    entity: "user",
    entityId: parsed.data.userId,
    description: `Approved pending access for ${approvedProfile?.email ?? parsed.data.userId}`,
  });

  return ok({ approved: true, userId: parsed.data.userId });
}

export async function DELETE(request: Request) {
  const result = await requireCompanyContext({ roles: [...ADMIN_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return fail("VALIDATION_ERROR", "userId is required", 400);

  const { data, error } = await supabase
    .from("company_members")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("user_id")
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Pending member not found", 404);

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  await recordAuditLog(supabase, {
    companyId,
    userId: user.id,
    userName: profile?.name ?? "Admin",
    action: "delete",
    entity: "user",
    entityId: userId,
    description: `Rejected pending access request for user ${userId}`,
  });

  return ok({ rejected: true });
}
