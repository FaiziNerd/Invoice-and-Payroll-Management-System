import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { patchInvoiceStatusSchema } from "@/lib/api/invoices/schemas";
import { auditMutation, getActorName } from "@/lib/server/audit-helpers";

const WRITE_ROLES = ["admin", "accountant"] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = patchInvoiceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("invoices")
    .select("id, status, invoice_number, amount_paid")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (fetchError) return fail("INTERNAL_ERROR", fetchError.message, 500);
  if (!existing) return fail("NOT_FOUND", "Invoice not found", 404);

  if (existing.status === "void") {
    return fail("VALIDATION_ERROR", "Void invoices cannot change status.", 400);
  }

  if (existing.status === "paid" || existing.status === "partially_paid") {
    return fail(
      "VALIDATION_ERROR",
      "Payment status is managed via recorded payments, not manual status changes.",
      400
    );
  }

  const timestamp = new Date().toISOString();
  const actorName = await getActorName(
    supabase,
    user.id,
    parsed.data.userName ?? "User"
  );

  const { data: row, error } = await supabase
    .from("invoices")
    .update({
      status: parsed.data.status,
      updated_at: timestamp,
    })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id, status")
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  if (!row) return fail("NOT_FOUND", "Invoice not found", 404);

  const { error: historyError } = await supabase.from("invoice_history").insert({
    invoice_id: id,
    action: `Status changed to ${parsed.data.status}`,
    timestamp,
    user_id: user.id,
    user_name: actorName,
  });

  if (historyError) return fail("INTERNAL_ERROR", historyError.message, 500);

  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "status_change",
    entity: "invoice",
    entityId: id,
    description: `Invoice ${existing.invoice_number} status changed to ${parsed.data.status}`,
    metadata: {
      before: { status: existing.status },
      after: { status: parsed.data.status },
    },
  });

  return ok({ id: row.id, status: row.status });
}
