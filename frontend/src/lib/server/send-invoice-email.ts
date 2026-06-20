import {
  buildInvoiceEmailContent,
  type EmailMode,
  type InvoiceEmailInput,
} from "@/lib/invoices/email-content";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local."
    );
    this.name = "EmailNotConfiguredError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) throw new EmailNotConfiguredError();
  return from;
}

function getApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new EmailNotConfiguredError();
  return apiKey;
}

export type InvoiceEmailAttachment = {
  filename: string;
  content: Buffer;
};

export async function deliverInvoiceEmail(
  input: InvoiceEmailInput,
  attachment?: InvoiceEmailAttachment
): Promise<{ id: string }> {
  const content = buildInvoiceEmailContent(input);

  const payload: Record<string, unknown> = {
    from: getFromAddress(),
    to: [content.to],
    subject: content.subject,
    text: content.text,
    html: content.html,
  };

  if (attachment) {
    payload.attachments = [
      {
        filename: attachment.filename,
        content: attachment.content.toString("base64"),
      },
    ];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as { id?: string; message?: string };

  if (!response.ok) {
    throw new EmailDeliveryError(result.message ?? `Resend HTTP ${response.status}`);
  }

  if (!result.id) {
    throw new EmailDeliveryError("Email provider returned no message id");
  }

  return { id: result.id };
}

export type { EmailMode };
