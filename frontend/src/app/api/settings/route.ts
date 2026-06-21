import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { rowToSettings, settingsFieldsToRow } from "@/lib/api/settings/mappers";
import { auditMutation, buildDiff, getActorName } from "@/lib/server/audit-helpers";

const WRITE_ROLES = ["admin"] as const;

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

  return ok({
    id: companyId,
    name: "My Company",
    address: "",
    defaultTemplateId: "",
  });
}

export async function PATCH(request: Request) {
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

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
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: before } = await supabase
    .from("organization_settings")
    .select("company_id, name, address, default_template_id")
    .eq("company_id", companyId)
    .maybeSingle();

  const rowPatch = settingsFieldsToRow(parsed.data);

  let data;
  let error;

  if (before) {
    ({ data, error } = await supabase
      .from("organization_settings")
      .update(rowPatch)
      .eq("company_id", companyId)
      .select("company_id, name, address, default_template_id, updated_at")
      .single());
  } else {
    const name = parsed.data.name?.trim() || "My Company";
    ({ data, error } = await supabase
      .from("organization_settings")
      .insert({
        company_id: companyId,
        name,
        address: rowPatch.address ?? null,
        default_template_id: rowPatch.default_template_id ?? null,
      })
      .select("company_id, name, address, default_template_id, updated_at")
      .single());
  }

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const actorName = await getActorName(supabase, user.id);
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "update",
    entity: "organization_settings",
    entityId: companyId,
    description: "Updated organization settings",
    metadata: buildDiff(
      {
        name: before?.name,
        address: before?.address,
        defaultTemplateId: before?.default_template_id,
      },
      {
        name: data.name,
        address: data.address,
        defaultTemplateId: data.default_template_id,
      }
    ),
  });

  return ok(rowToSettings(data));
}
