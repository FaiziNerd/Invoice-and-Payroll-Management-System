import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Invoice, InvoiceTemplate } from "@/types";
import {
  rowToInvoice,
  INVOICE_SELECT,
  type InvoiceHistoryRow,
  type InvoiceItemRow,
  type InvoiceRow,
} from "@/lib/api/invoices/mappers";
import { rowToClient } from "@/lib/api/clients/mappers";
import { rowToTemplate, type InvoiceTemplateRow } from "@/lib/api/templates/mappers";
import { InvoicePDFDocument } from "@/lib/pdf/invoice-pdf-document";

type InvoiceWithRelations = InvoiceRow & {
  invoice_items: InvoiceItemRow[] | null;
  invoice_history: InvoiceHistoryRow[] | null;
};

export async function generateInvoicePdfBuffer(
  supabase: SupabaseClient,
  companyId: string,
  invoiceId: string
): Promise<{ buffer: Buffer; invoice: Invoice; filename: string }> {
  const { data: row, error } = await supabase
    .from("invoices")
    .select(
      INVOICE_SELECT +
        ", invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name)"
    )
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !row) {
    throw new Error(error?.message ?? "Invoice not found");
  }

  const invoiceRow = row as unknown as InvoiceWithRelations;
  const invoice = rowToInvoice(
    invoiceRow,
    (invoiceRow.invoice_items ?? []).sort((a, b) => a.id.localeCompare(b.id)),
    (invoiceRow.invoice_history ?? []).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    )
  );

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("id, company_id, name, email, phone, address, created_at, deleted_at")
    .eq("id", invoiceRow.client_id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (clientError || !clientRow) {
    throw new Error(clientError?.message ?? "Client not found");
  }

  const client: Client = rowToClient(clientRow);

  let template: InvoiceTemplate | undefined;
  if (invoiceRow.template_id) {
    const { data: templateRow } = await supabase
      .from("invoice_templates")
      .select(
        "id, company_id, name, is_default, is_active, theme, branding_logo, branding_primary_color, branding_secondary_color, branding_font_family, branding_show_logo, branding_show_notes, branding_show_payment_terms, branding_show_footer, branding_company_name, branding_company_address, branding_payment_terms, branding_footer_text, created_at, updated_at"
      )
      .eq("id", invoiceRow.template_id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (templateRow) {
      template = rowToTemplate(templateRow as InvoiceTemplateRow);
    }
  }

  const { data: settings } = await supabase
    .from("organization_settings")
    .select("name, address")
    .eq("company_id", companyId)
    .maybeSingle();

  const buffer = await renderToBuffer(
    <InvoicePDFDocument
      invoice={invoice}
      client={client}
      template={template}
      org={{
        companyName: settings?.name ?? undefined,
        companyAddress: settings?.address ?? undefined,
      }}
    />
  );

  return {
    buffer: Buffer.from(buffer),
    invoice,
    filename: `${invoice.invoiceNumber}.pdf`,
  };
}
