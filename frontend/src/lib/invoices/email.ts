import type { Client, Invoice } from "@/types";
import {
  buildInvoiceEmailContent,
  buildInvoiceShareUrl,
  type EmailMode,
} from "@/lib/invoices/email-content";
import { getOrganizationCompanyName } from "@/lib/repositories/settings";

export type { EmailMode };

export interface InvoiceEmailPreview {
  to: string;
  subject: string;
  body: string;
  shareUrl: string;
}

export function buildInvoiceEmailPreview(
  invoice: Invoice,
  client: Client,
  mode: EmailMode,
  origin?: string
): InvoiceEmailPreview {
  const shareUrl = buildInvoiceShareUrl(
    invoice.shareToken,
    origin ?? (typeof window !== "undefined" ? window.location.origin : undefined)
  );

  const content = buildInvoiceEmailContent({
    invoiceNumber: invoice.invoiceNumber,
    total: invoice.total,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    clientName: client.name,
    clientEmail: client.email,
    companyName: getOrganizationCompanyName() || "Your Company",
    shareUrl,
    mode,
  });

  return {
    to: content.to,
    subject: content.subject,
    body: content.text,
    shareUrl,
  };
}

export function getEmailDialogTitle(mode: EmailMode): string {
  switch (mode) {
    case "send":
      return "Send Invoice";
    case "resend":
      return "Resend Invoice";
    case "reminder":
      return "Send Payment Reminder";
  }
}
