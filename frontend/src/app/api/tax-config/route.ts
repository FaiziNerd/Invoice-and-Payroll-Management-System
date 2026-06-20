import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { auditMutation, buildDiff, getActorName } from "@/lib/server/audit-helpers";

const WRITE_ROLES = ["admin", "accountant"] as const;

const taxConfigSchema = z.object({
  name: z.string().trim().min(1, "Tax name is required"),
  rate: z.number().finite().min(0, "Rate cannot be negative"),
  isInclusive: z.boolean(),
});

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("org_tax_configs")
    .select("id, company_id, name, rate, is_inclusive, is_active, updated_at")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);

  if (!data) {
    return ok({
      name: "Sales Tax",
      rate: 0,
      isInclusive: false,
      isActive: true,
    });
  }

  return ok({
    id: data.id,
    name: data.name,
    rate: Number(data.rate),
    isInclusive: data.is_inclusive,
    isActive: data.is_active,
    updatedAt: data.updated_at,
  });
}

export async function PUT(request: Request) {
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = taxConfigSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: existing } = await supabase
    .from("org_tax_configs")
    .select("id, name, rate, is_inclusive")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from("org_tax_configs")
    .upsert(
      {
        company_id: companyId,
        name: parsed.data.name,
        rate: parsed.data.rate,
        is_inclusive: parsed.data.isInclusive,
        is_active: true,
        updated_at: timestamp,
      },
      { onConflict: "company_id" }
    )
    .select("id, name, rate, is_inclusive, is_active, updated_at")
    .single();

  if (error) {
    // unique partial index may block upsert on conflict — deactivate others then insert
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("org_tax_configs")
        .update({
          name: parsed.data.name,
          rate: parsed.data.rate,
          is_inclusive: parsed.data.isInclusive,
          updated_at: timestamp,
        })
        .eq("id", existing.id)
        .select("id, name, rate, is_inclusive, is_active, updated_at")
        .single();

      if (updateError) return fail("INTERNAL_ERROR", updateError.message, 500);

      const actorName = await getActorName(supabase, user.id);
      await auditMutation(supabase, {
        companyId,
        userId: user.id,
        userName: actorName,
        action: "update",
        entity: "tax_config",
        entityId: updated.id,
        description: `Updated tax configuration to ${parsed.data.name} at ${parsed.data.rate}%`,
        metadata: buildDiff(
          {
            name: existing.name,
            rate: Number(existing.rate),
            isInclusive: existing.is_inclusive,
          },
          {
            name: parsed.data.name,
            rate: parsed.data.rate,
            isInclusive: parsed.data.isInclusive,
          }
        ),
      });

      return ok({
        id: updated.id,
        name: updated.name,
        rate: Number(updated.rate),
        isInclusive: updated.is_inclusive,
        isActive: updated.is_active,
        updatedAt: updated.updated_at,
      });
    }
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const actorName = await getActorName(supabase, user.id);
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: existing ? "update" : "create",
    entity: "tax_config",
    entityId: data.id,
    description: `${existing ? "Updated" : "Created"} tax configuration: ${parsed.data.name}`,
    metadata: existing
      ? buildDiff(
          {
            name: existing.name,
            rate: Number(existing.rate),
            isInclusive: existing.is_inclusive,
          },
          {
            name: parsed.data.name,
            rate: parsed.data.rate,
            isInclusive: parsed.data.isInclusive,
          }
        )
      : { after: parsed.data },
  });

  return ok({
    id: data.id,
    name: data.name,
    rate: Number(data.rate),
    isInclusive: data.is_inclusive,
    isActive: data.is_active,
    updatedAt: data.updated_at,
  });
}
