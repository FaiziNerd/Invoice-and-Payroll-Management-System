import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { createClientSchema } from "@/lib/api/clients/schemas";
import { clientFieldsToRow, rowToClient } from "@/lib/api/clients/mappers";
import { recordAuditLog } from "@/lib/server/record-audit-log";

const WRITE_ROLES = ["admin", "accountant"] as const;

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("clients")
    .select("id, company_id, name, email, phone, address, created_at")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok((data ?? []).map(rowToClient));
}

export async function POST(request: Request) {
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_id: companyId,
      ...clientFieldsToRow(parsed.data),
    })
    .select("id, company_id, name, email, phone, address, created_at")
    .single();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
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
    action: "create",
    entity: "client",
    entityId: client.id,
    description: `Created client ${client.name}`,
  });

  return ok(client, 201);
}
