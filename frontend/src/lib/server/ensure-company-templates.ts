import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedCompanyTemplates } from "@/lib/server/seed-company-templates";

/**
 * Ensures a company has invoice templates, seeding presets when none exist.
 * Safe to call on every templates fetch (idempotent).
 */
export async function ensureCompanyTemplates(
  companyId: string,
  admin?: SupabaseClient
): Promise<void> {
  const client = admin ?? createAdminClient();

  const { count, error: countError } = await client
    .from("invoice_templates")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) return;

  const { data: company, error: companyError } = await client
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    throw new Error(companyError.message);
  }

  await seedCompanyTemplates(client, companyId, company?.name?.trim() || "My Company");
}
