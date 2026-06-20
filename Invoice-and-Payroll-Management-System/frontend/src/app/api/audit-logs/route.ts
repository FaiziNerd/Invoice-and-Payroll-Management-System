import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import type { AuditAction } from "@/types";

type AuditLogRow = {
  id: string;
  action: AuditAction;
  entity: string;
  entity_id: string | null;
  user_id: string | null;
  user_name: string;
  description: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
};

function rowToAuditLog(row: AuditLogRow) {
  return {
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id ?? undefined,
    userId: row.user_id ?? "",
    userName: row.user_name,
    description: row.description,
    metadata: row.metadata ?? undefined,
    timestamp: row.timestamp,
  };
}

export async function GET(request: Request) {
  const result = await requireCompanyContext({ roles: ["admin"] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50)
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, entity, entity_id, user_id, user_name, description, metadata, timestamp",
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .order("timestamp", { ascending: false })
    .range(from, to);

  if (error) return fail("INTERNAL_ERROR", error.message, 500);

  return ok({
    logs: (data ?? []).map((row) => rowToAuditLog(row as AuditLogRow)),
    page,
    limit,
    total: count ?? 0,
  });
}

export async function POST() {
  return fail(
    "FORBIDDEN",
    "Audit logs are recorded server-side only and cannot be created from the client",
    403
  );
}
