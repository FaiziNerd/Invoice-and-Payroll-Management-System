import type { SupabaseClient } from "@supabase/supabase-js";

function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(4, "0")}`;
}

/** Preview the next invoice number without consuming the sequence. */
export async function peekNextInvoiceNumber(
  supabase: SupabaseClient,
  companyId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("invoice_number_sequences")
    .select("last_number")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const last = data?.last_number ?? 0;
  return formatInvoiceNumber(last + 1);
}

/** Allocate the next gap-free invoice number for a company (row-locked in DB). */
export async function allocateNextInvoiceNumber(
  supabase: SupabaseClient,
  companyId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("next_invoice_number", {
    p_company_id: companyId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data !== "string" || !data) {
    throw new Error("Failed to allocate invoice number");
  }

  return data;
}
