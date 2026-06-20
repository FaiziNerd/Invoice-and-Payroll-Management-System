import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceStatus } from "@/types";

export type PaymentVariance = "none" | "overpayment";

export interface PaymentSyncResult {
  amountPaid: number;
  status: InvoiceStatus;
  paymentVariance: PaymentVariance;
}

const ISSUED_STATUSES = new Set<InvoiceStatus>([
  "sent",
  "overdue",
  "partially_paid",
  "paid",
]);

/** Derive invoice payment status from recorded payments vs invoice total. */
export function derivePaymentStatus(
  total: number,
  amountPaid: number,
  currentStatus: InvoiceStatus
): PaymentSyncResult {
  const variance: PaymentVariance =
    amountPaid > total + 0.001 ? "overpayment" : "none";

  if (currentStatus === "draft" || currentStatus === "void") {
    return { amountPaid, status: currentStatus, paymentVariance: variance };
  }

  if (amountPaid >= total - 0.001) {
    return { amountPaid, status: "paid", paymentVariance: variance };
  }

  if (amountPaid > 0 && ISSUED_STATUSES.has(currentStatus)) {
    return { amountPaid, status: "partially_paid", paymentVariance: "none" };
  }

  return { amountPaid, status: currentStatus, paymentVariance: variance };
}

export async function sumInvoicePayments(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  if (error) throw new Error(error.message);

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

export async function syncInvoicePaymentState(
  supabase: SupabaseClient,
  invoiceId: string,
  companyId: string
): Promise<PaymentSyncResult & { invoiceTotal: number }> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("total, status")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) throw new Error("Invoice not found");

  const total = Number(invoice.total);
  const amountPaid = await sumInvoicePayments(supabase, invoiceId);
  const derived = derivePaymentStatus(
    total,
    amountPaid,
    invoice.status as InvoiceStatus
  );

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: derived.amountPaid,
      status: derived.status,
      payment_variance: derived.paymentVariance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("company_id", companyId);

  if (updateError) throw new Error(updateError.message);

  return { ...derived, invoiceTotal: total };
}
