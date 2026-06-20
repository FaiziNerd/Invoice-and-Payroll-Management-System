import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { promoteOverdueInvoices } from "@/lib/api/invoices/promote-overdue";

export async function POST() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  try {
    const promoted = await promoteOverdueInvoices(supabase, companyId);
    return ok({ promoted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve overdue invoices";
    return fail("INTERNAL_ERROR", message, 500);
  }
}
