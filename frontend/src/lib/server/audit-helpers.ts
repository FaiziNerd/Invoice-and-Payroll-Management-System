import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAuditLog, type RecordAuditLogInput } from "@/lib/server/record-audit-log";

export async function getActorName(
  supabase: SupabaseClient,
  userId: string,
  fallback = "User"
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  return data?.name ?? fallback;
}

export async function auditMutation(
  supabase: SupabaseClient,
  input: RecordAuditLogInput
): Promise<void> {
  await recordAuditLog(supabase, input);
}

export function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }

  return { before: changedBefore, after: changedAfter };
}
