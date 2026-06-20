import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { peekNextInvoiceNumber } from "@/lib/api/invoices/numbering";

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  try {
    const invoiceNumber = await peekNextInvoiceNumber(supabase, companyId);
    return ok({ invoiceNumber });
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Failed to preview invoice number",
      500
    );
  }
}
