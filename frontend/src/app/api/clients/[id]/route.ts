import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { updateClientSchema } from "@/lib/api/clients/schemas";
import { clientFieldsToRow, rowToClient } from "@/lib/api/clients/mappers";
import { recordAuditLog } from "@/lib/server/record-audit-log";

const WRITE_ROLES = ["admin", "accountant"] as const;
const CLIENT_SELECT = "id, company_id, name, email, phone, address, created_at, deleted_at";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Client not found", 404);
  }

  return ok(rowToClient(data));
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const updates: Record<string, string | null> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.phone !== undefined) {
    updates.phone = parsed.data.phone || null;
  }
  if (parsed.data.address !== undefined) {
    updates.address = parsed.data.address || null;
  }
  if (parsed.data.restore === true) {
    updates.deleted_at = null;
  }

  const { data, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(CLIENT_SELECT)
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Client not found", 404);
  }

  const client = rowToClient(data);
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  await recordAuditLog(supabase, {
    companyId,
    userId: user.id,
    userName: profile?.name ?? "User",
    action: parsed.data.restore ? "update" : "update",
    entity: "client",
    entityId: client.id,
    description: parsed.data.restore
      ? `Restored client ${client.name}`
      : `Updated client ${client.name}`,
  });

  return ok(client);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  const { data: existing } = await supabase
    .from("clients")
    .select("name, deleted_at")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!existing) {
    return fail("NOT_FOUND", "Client not found", 404);
  }

  if (existing.deleted_at) {
    return ok({ deleted: true, alreadyDeleted: true });
  }

  const { data, error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Client not found", 404);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  await recordAuditLog(supabase, {
    companyId,
    userId: user.id,
    userName: profile?.name ?? "User",
    action: "delete",
    entity: "client",
    entityId: id,
    description: `Soft-deleted client ${existing.name}`,
  });

  return ok({ deleted: true });
}
