import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { patchInvoiceStatusSchema } from "@/lib/api/invoices/schemas";

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
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const timestamp = new Date().toISOString();
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
    user_name: parsed.data.userName || "User",
  });

  if (historyError) return fail("INTERNAL_ERROR", historyError.message, 500);

  return ok({ id: row.id, status: row.status });
}
