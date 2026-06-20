import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { rowToSettings, settingsFieldsToRow } from "@/lib/api/settings/mappers";

const WRITE_ROLES = ["admin", "accountant"] as const;

const updateSettingsSchema = z
  .object({
    name: z.string().trim().min(1, "Organization name is required").optional(),
    address: z.string().optional(),
    defaultTemplateId: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("organization_settings")
    .select("company_id, name, address, default_template_id, updated_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (data) {
    return ok(rowToSettings(data));
  }

  const { data: inserted, error: insertError } = await supabase
    .from("organization_settings")
    .insert({
      company_id: companyId,
      name: "My Company",
      address: null,
      default_template_id: null,
    })
    .select("company_id, name, address, default_template_id, updated_at")
    .single();

  if (insertError) {
    return fail("INTERNAL_ERROR", insertError.message, 500);
  }

  return ok(rowToSettings(inserted));
}

export async function PATCH(request: Request) {
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data, error } = await supabase
    .from("organization_settings")
    .upsert(
      {
        company_id: companyId,
        ...settingsFieldsToRow(parsed.data),
      },
      { onConflict: "company_id" }
    )
    .select("company_id, name, address, default_template_id, updated_at")
    .single();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok(rowToSettings(data));
}
