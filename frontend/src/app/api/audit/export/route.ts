import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { auditMutation, getActorName } from "@/lib/server/audit-helpers";

const exportAuditSchema = z.object({
  entity: z.string().trim().min(1),
  description: z.string().trim().min(1),
  entityId: z.string().optional(),
});

export async function POST(request: Request) {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = exportAuditSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const actorName = await getActorName(supabase, user.id);

  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "export",
    entity: parsed.data.entity,
    entityId: parsed.data.entityId,
    description: parsed.data.description,
  });

  return ok({ recorded: true });
}
