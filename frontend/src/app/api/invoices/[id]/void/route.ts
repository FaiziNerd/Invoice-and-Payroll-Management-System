import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { auditMutation, getActorName } from "@/lib/server/audit-helpers";

const WRITE_ROLES = ["admin", "accountant"] as const;

const voidInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "Void reason is required"),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
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

  const parsed = voidInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, status, invoice_number, total, amount_paid")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (fetchError) return fail("INTERNAL_ERROR", fetchError.message, 500);
  if (!invoice) return fail("NOT_FOUND", "Invoice not found", 404);

  if (invoice.status === "draft") {
    return fail(
      "VALIDATION_ERROR",
      "Draft invoices can be deleted, not voided. Use delete instead.",
      400
    );
  }

  if (invoice.status === "void") {
    return fail("VALIDATION_ERROR", "Invoice is already void.", 400);
  }

  const timestamp = new Date().toISOString();
  const actorName = await getActorName(supabase, user.id);

  const { data: updated, error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "void",
      void_reason: parsed.data.reason,
      voided_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id, status, void_reason, voided_at")
    .single();

  if (updateError) return fail("INTERNAL_ERROR", updateError.message, 500);

  await supabase.from("invoice_history").insert({
    invoice_id: id,
    action: `Invoice voided: ${parsed.data.reason}`,
    timestamp,
    user_id: user.id,
    user_name: actorName,
  });

  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "void",
    entity: "invoice",
    entityId: id,
    description: `Voided invoice ${invoice.invoice_number}`,
    metadata: {
      reason: parsed.data.reason,
      before: {
        status: invoice.status,
        total: Number(invoice.total),
        amountPaid: Number(invoice.amount_paid),
      },
      after: { status: "void", voidReason: parsed.data.reason },
    },
  });

  return ok(updated);
}
