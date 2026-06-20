import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";

function deriveNextInvoiceNumber(values: string[]): string {
  const max = values.reduce((acc, current) => {
    const match = /^INV-(\d+)$/i.exec(current.trim());
    if (!match) return acc;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? Math.max(acc, parsed) : acc;
  }, 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("company_id", companyId);

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const invoiceNumber = deriveNextInvoiceNumber(
    (data ?? []).map((row) => row.invoice_number as string)
  );

  return ok({ invoiceNumber });
}
