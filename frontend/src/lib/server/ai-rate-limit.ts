import type { SupabaseClient } from "@supabase/supabase-js";

const HOURLY_LIMIT = 30;

export async function checkAiDraftRateLimit(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("ai_draft_usage")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("used_at", since);

  if (error) {
    console.error("[ai-rate-limit]", error.message);
    return { allowed: true, remaining: HOURLY_LIMIT };
  }

  const used = count ?? 0;
  return {
    allowed: used < HOURLY_LIMIT,
    remaining: Math.max(0, HOURLY_LIMIT - used),
  };
}

export async function recordAiDraftUsage(
  supabase: SupabaseClient,
  companyId: string
): Promise<void> {
  await supabase.from("ai_draft_usage").insert({ company_id: companyId });
}
