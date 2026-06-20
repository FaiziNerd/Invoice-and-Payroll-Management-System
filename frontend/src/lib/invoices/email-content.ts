import { formatCurrency, formatDate } from "@/lib/utils";

export type EmailMode = "send" | "resend" | "reminder";

export interface InvoiceEmailContent {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface InvoiceEmailInput {
  invoiceNumber: string;
  total: number;
  issueDate: string;
  dueDate: string;
  notes?: string | null;
  clientName: string;
  clientEmail: string;
  companyName: string;
  shareUrl: string;
  mode: EmailMode;
}

export function buildInvoiceSharePath(shareToken: string): string {
  return `/share/invoice/${shareToken}`;
}

export function resolveAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function buildInvoiceShareUrl(shareToken: string, origin?: string): string {
  const base = (origin ?? resolveAppOrigin()).replace(/\/$/, "");
  return `${base}${buildInvoiceSharePath(shareToken)}`;
}

export function buildInvoiceEmailContent(input: InvoiceEmailInput): InvoiceEmailContent {
  const {
    invoiceNumber,
    total,
    issueDate,
    dueDate,
    notes,
    clientName,
    clientEmail,
    companyName,
    shareUrl,
    mode,
  } = input;

  const amount = formatCurrency(total);
  const issued = formatDate(issueDate);
  const due = formatDate(dueDate);

  if (mode === "reminder") {
    const subject = `Payment Reminder: Invoice ${invoiceNumber} from ${companyName}`;
    const text = [
      `Dear ${clientName},`,
      "",
      `This is a friendly reminder that invoice ${invoiceNumber} for ${amount} was due on ${due}.`,
      "",
      "Please arrange payment at your earliest convenience. If you have already paid, please disregard this message.",
      "",
      "Invoice summary:",
      `- Amount due: ${amount}`,
      `- Issue date: ${issued}`,
      `- Due date: ${due}`,
      "",
      `View invoice: ${shareUrl}`,
      "",
      "Thank you for your business.",
      companyName,
    ].join("\n");

    const html = `
      <p>Dear ${escapeHtml(clientName)},</p>
      <p>This is a friendly reminder that invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${escapeHtml(amount)}</strong> was due on ${escapeHtml(due)}.</p>
      <p>Please arrange payment at your earliest convenience. If you have already paid, please disregard this message.</p>
      <ul>
        <li>Amount due: ${escapeHtml(amount)}</li>
        <li>Issue date: ${escapeHtml(issued)}</li>
        <li>Due date: ${escapeHtml(due)}</li>
      </ul>
      <p><a href="${escapeHtml(shareUrl)}">View invoice online</a></p>
      <p>Thank you for your business.<br/>${escapeHtml(companyName)}</p>
    `.trim();

    return { to: clientEmail, subject, text, html };
  }

  const subject = `Invoice ${invoiceNumber} from ${companyName}`;
  const text = [
    `Dear ${clientName},`,
    "",
    `Please find invoice ${invoiceNumber} for ${amount}.`,
    "",
    `Issue date: ${issued}`,
    `Due date: ${due}`,
    notes ? `Notes: ${notes}` : "",
    "",
    `View and download your invoice here: ${shareUrl}`,
    "",
    "Thank you for your business.",
    companyName,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>Dear ${escapeHtml(clientName)},</p>
    <p>Please find invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${escapeHtml(amount)}</strong>.</p>
    <p>
      Issue date: ${escapeHtml(issued)}<br/>
      Due date: ${escapeHtml(due)}
    </p>
    ${notes ? `<p>Notes: ${escapeHtml(notes)}</p>` : ""}
    <p><a href="${escapeHtml(shareUrl)}">View invoice online</a></p>
    <p>Thank you for your business.<br/>${escapeHtml(companyName)}</p>
  `.trim();

  return { to: clientEmail, subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function invoiceEmailHistoryAction(
  mode: EmailMode,
  clientEmail: string
): string {
  switch (mode) {
    case "send":
      return `Invoice sent to ${clientEmail}`;
    case "resend":
      return `Invoice resent to ${clientEmail}`;
    case "reminder":
      return `Payment reminder sent to ${clientEmail}`;
  }
}
