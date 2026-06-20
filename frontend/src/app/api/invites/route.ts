import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { generateInviteToken } from "@/lib/server/tokens";
import { recordAuditLog } from "@/lib/server/record-audit-log";
import { z } from "zod";

const ADMIN_ROLES = ["admin"] as const;

const createInviteSchema = z.object({
  role: z.enum(["accountant", "hr"]).default("accountant"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function GET() {
  const result = await requireCompanyContext({ roles: [...ADMIN_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("company_invites")
    .select("id, token, role, used_at, used_by, expires_at, created_at")
    .eq("company_id", companyId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) return fail("INTERNAL_ERROR", error.message, 500);

  return ok(data ?? []);
}

export async function POST(request: Request) {
  const result = await requireCompanyContext({ roles: [...ADMIN_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.data.expiresInDays);

  const { data, error } = await supabase
    .from("company_invites")
    .insert({
      company_id: companyId,
      token,
      role: parsed.data.role,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, token, role, expires_at, created_at")
    .single();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  await recordAuditLog(supabase, {
    companyId,
    userId: user.id,
    userName: profile?.name ?? "Admin",
    action: "create",
    entity: "invite",
    entityId: data.id,
    description: `Generated ${parsed.data.role} invite code (expires ${expiresAt.toLocaleDateString()})`,
  });

  return ok(data, 201);
}

export async function DELETE(request: Request) {
  const result = await requireCompanyContext({ roles: [...ADMIN_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("VALIDATION_ERROR", "id is required", 400);

  const { data, error } = await supabase
    .from("company_invites")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Invite not found", 404);

  return ok({ deleted: true });
}
