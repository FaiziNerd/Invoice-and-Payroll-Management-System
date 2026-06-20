import type { Client, Invoice } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getOrganizationCompanyName } from "@/lib/repositories/settings";

export type EmailMode = "send" | "resend" | "reminder";

export interface InvoiceEmailPreview {
  to: string;
  subject: string;
  body: string;
}

export function buildInvoiceEmailPreview(
  invoice: Invoice,
  client: Client,
  mode: EmailMode
): InvoiceEmailPreview {
  const company = getOrganizationCompanyName();
  const to = client.email;

  if (mode === "reminder") {
    return {
      to,
      subject: `Payment Reminder: Invoice ${invoice.invoiceNumber} from ${company}`,
      body: [
        `Dear ${client.name},`,
        "",
        `This is a friendly reminder that invoice ${invoice.invoiceNumber} for ${formatCurrency(invoice.total)} was due on ${formatDate(invoice.dueDate)}.`,
        "",
        "Please arrange payment at your earliest convenience. If you have already paid, please disregard this message.",
        "",
        `Invoice summary:`,
        `- Amount due: ${formatCurrency(invoice.total)}`,
        `- Issue date: ${formatDate(invoice.issueDate)}`,
        `- Due date: ${formatDate(invoice.dueDate)}`,
        "",
        "Thank you for your business.",
        company,
      ].join("\n"),
    };
  }

  const verb = mode === "resend" ? "resending" : "sending";
  return {
    to,
    subject: `Invoice ${invoice.invoiceNumber} from ${company}`,
    body: [
      `Dear ${client.name},`,
      "",
      `Please find attached invoice ${invoice.invoiceNumber} for ${formatCurrency(invoice.total)}.`,
      "",
      `Issue date: ${formatDate(invoice.issueDate)}`,
      `Due date: ${formatDate(invoice.dueDate)}`,
      "",
      invoice.notes ? `Notes: ${invoice.notes}` : "",
      "",
      "You can view and pay this invoice using the secure link included in this email.",
      "",
      `Thank you for your business.`,
      company,
      "",
      `(Mock email — ${verb} locally, no message was actually delivered.)`,
    ]
      .filter(Boolean)
      .join("\n"),
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
