"use client";

import { pdf } from "@react-pdf/renderer";
import type { Invoice, Client, InvoiceTemplate } from "@/types";
import { getOrganizationAddress, getOrganizationCompanyName } from "@/lib/repositories/settings";
import { InvoicePDFDocument } from "@/lib/pdf/invoice-pdf-document";

export async function downloadInvoicePDF(
  invoice: Invoice,
  client: Client,
  template?: InvoiceTemplate
) {
  const blob = await pdf(
    <InvoicePDFDocument
      invoice={invoice}
      client={client}
      template={template}
      org={{
        companyName: getOrganizationCompanyName(),
        companyAddress: getOrganizationAddress(),
      }}
    />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.invoiceNumber}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export { InvoicePDFDocument } from "@/lib/pdf/invoice-pdf-document";
