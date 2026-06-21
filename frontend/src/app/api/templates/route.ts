import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { createTemplateSchema } from "@/lib/api/templates/schemas";
import { rowToTemplate, templateFieldsToRow } from "@/lib/api/templates/mappers";
import { ensureCompanyTemplates } from "@/lib/server/ensure-company-templates";
import { auditMutation, getActorName } from "@/lib/server/audit-helpers";

const WRITE_ROLES = ["admin", "accountant"] as const;

const TEMPLATE_COLUMNS =
  "id, company_id, name, is_default, is_active, theme, branding_logo, branding_primary_color, branding_secondary_color, branding_font_family, branding_show_logo, branding_show_notes, branding_show_payment_terms, branding_show_footer, branding_company_name, branding_company_address, branding_payment_terms, branding_footer_text, created_at, updated_at";

export async function GET(request: Request) {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const trashOnly = new URL(request.url).searchParams.get("trash") === "true";

  if (!trashOnly) {
    try {
      await ensureCompanyTemplates(companyId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to seed templates";
      return fail("INTERNAL_ERROR", message, 500);
    }
  }

  let query = supabase
    .from("invoice_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  query = trashOnly ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

  const { data, error } = await query;

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok((data ?? []).map(rowToTemplate));
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

  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  if (parsed.data.isDefault) {
    const { error: resetError } = await supabase
      .from("invoice_templates")
      .update({ is_default: false })
      .eq("company_id", companyId)
      .eq("is_default", true);
    if (resetError) {
      return fail("INTERNAL_ERROR", resetError.message, 500);
    }
  }

  const { data, error } = await supabase
    .from("invoice_templates")
    .insert({
      company_id: companyId,
      ...templateFieldsToRow(parsed.data),
    })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const actorName = await getActorName(supabase, user.id, "User");
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "create",
    entity: "template",
    entityId: data.id,
    description: `Created invoice template ${parsed.data.name}`,
    metadata: { after: { name: parsed.data.name, theme: parsed.data.theme } },
  });

  return ok(rowToTemplate(data), 201);
}
