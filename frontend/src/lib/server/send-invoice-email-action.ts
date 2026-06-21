import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INVOICE_SELECT,
  type InvoiceHistoryRow,
  type InvoiceItemRow,
  type InvoiceRow,
} from "@/lib/api/invoices/mappers";
import {
  buildInvoiceShareUrl,
  invoiceEmailHistoryAction,
} from "@/lib/invoices/email-content";
import {
  deliverInvoiceEmail,
  EmailDeliveryError,
  EmailNotConfiguredError,
  type EmailMode,
} from "@/lib/server/send-invoice-email";
import { generateInvoicePdfBuffer } from "@/lib/server/generate-invoice-pdf";
import { recordAuditLog } from "@/lib/server/record-audit-log";

type InvoiceWithClient = InvoiceRow & {
  invoice_items: InvoiceItemRow[] | null;
  invoice_history: InvoiceHistoryRow[] | null;
  clients: { id: string; name: string; email: string } | null;
};

export async function sendInvoiceEmailAction(
  supabase: SupabaseClient,
  companyId: string,
  invoiceId: string,
  userId: string,
  userName: string,
  mode: EmailMode
): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from("invoices")
    .select(
      INVOICE_SELECT +
        ", invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name), clients(id, name, email)"
    )
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Invoice not found");

  const invoiceRow = row as unknown as InvoiceWithClient;
  const clientRaw = invoiceRow.clients;
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
  if (!client?.email) {
    throw new Error("Client email address is required");
  }

  const { data: settings } = await supabase
    .from("organization_settings")
    .select("name")
    .eq("company_id", companyId)
    .maybeSingle();

  const companyName = settings?.name?.trim() || "Your Company";
  const shareUrl = buildInvoiceShareUrl(invoiceRow.share_token);

  const { buffer: pdfBuffer, filename: pdfFilename } = await generateInvoicePdfBuffer(
    supabase,
    companyId,
    invoiceId
  );

  const delivery = await deliverInvoiceEmail(
    {
      invoiceNumber: invoiceRow.invoice_number,
      total: Number(invoiceRow.total),
      issueDate: invoiceRow.issue_date,
      dueDate: invoiceRow.due_date,
      notes: invoiceRow.notes,
      clientName: client.name,
      clientEmail: client.email,
      companyName,
      shareUrl,
      mode,
    },
    { filename: pdfFilename, content: pdfBuffer }
  );

  const historyAction = invoiceEmailHistoryAction(mode, client.email);
  const actorName = userName.trim() || "User";

  const { error: historyError } = await supabase.from("invoice_history").insert({
    invoice_id: invoiceId,
    action: historyAction,
    user_id: userId,
    user_name: actorName,
  });
  if (historyError) throw new Error(historyError.message);

  if (mode === "send" && invoiceRow.status === "draft") {
    const { error: statusError } = await supabase
      .from("invoices")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("company_id", companyId);
    if (statusError) throw new Error(statusError.message);
  }

  await recordAuditLog(supabase, {
    companyId,
    userId,
    userName: actorName,
    action: "send",
    entity: "invoice",
    entityId: invoiceId,
    description: historyAction,
    metadata: { mode, resendId: delivery.id, clientEmail: client.email },
  });
}

export { EmailNotConfiguredError, EmailDeliveryError };
