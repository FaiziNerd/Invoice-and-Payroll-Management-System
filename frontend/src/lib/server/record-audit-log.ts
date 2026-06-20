import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction } from "@/types";

export interface RecordAuditLogInput {
  companyId: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/** Write an audit log entry using the authenticated server session identity. */
export async function recordAuditLog(
  supabase: SupabaseClient,
  input: RecordAuditLogInput
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    company_id: input.companyId,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    user_id: input.userId,
    user_name: input.userName,
    description: input.description,
    metadata: input.metadata ?? null,
  });

  if (error) {
    console.error("[audit] failed to record entry:", error.message);
  }
}
