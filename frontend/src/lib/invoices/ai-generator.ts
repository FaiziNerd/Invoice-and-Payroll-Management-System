import type { Client, InvoiceLineItem } from "@/types";
import { generateId } from "@/lib/utils";
import type { InvoiceFormValues } from "@/components/invoices/invoice-form";

const SERVICE_CATALOG: { keywords: string[]; description: string; unitPrice: number }[] = [
  { keywords: ["web", "website", "frontend"], description: "Web Development Services", unitPrice: 3500 },
  { keywords: ["design", "ui", "ux"], description: "UI/UX Design", unitPrice: 2200 },
  { keywords: ["consult", "advisory"], description: "Consulting Services", unitPrice: 1800 },
  { keywords: ["maintenance", "support"], description: "Annual Maintenance & Support", unitPrice: 1200 },
  { keywords: ["hosting", "cloud", "infra"], description: "Cloud Infrastructure Setup", unitPrice: 950 },
  { keywords: ["mobile", "app", "ios", "android"], description: "Mobile App Development", unitPrice: 4200 },
  { keywords: ["seo", "marketing"], description: "Digital Marketing Package", unitPrice: 1500 },
  { keywords: ["training", "workshop"], description: "Team Training Workshop", unitPrice: 800 },
];

function matchServices(prompt: string): InvoiceLineItem[] {
  const lower = prompt.toLowerCase();
  const matched = SERVICE_CATALOG.filter((s) =>
    s.keywords.some((kw) => lower.includes(kw))
  );

  const items = (matched.length > 0 ? matched : [SERVICE_CATALOG[0], SERVICE_CATALOG[1]]).map(
    (s) => ({
      id: generateId(),
      description: s.description,
      quantity: lower.includes("month") || lower.includes("retainer") ? 3 : 1,
      unitPrice: s.unitPrice,
      amount: 0,
    })
  );

  return items.map((item) => ({
    ...item,
    amount: item.quantity * item.unitPrice,
  }));
}

function pickClient(clients: Client[], prompt: string): string {
  if (clients.length === 0) return "";
  const lower = prompt.toLowerCase();
  const byName = clients.find((c) => lower.includes(c.name.toLowerCase().split(" ")[0]));
  return byName?.id || clients[0].id;
}

function inferTaxRate(prompt: string): number {
  const lower = prompt.toLowerCase();
  if (lower.includes("no tax") || lower.includes("tax exempt")) return 0;
  if (lower.includes("15%") || lower.includes("15 percent")) return 15;
  return 10;
}

function inferDueDays(prompt: string): number {
  const lower = prompt.toLowerCase();
  if (lower.includes("net 15") || lower.includes("15 days")) return 15;
  if (lower.includes("net 60") || lower.includes("60 days")) return 60;
  return 30;
}

export interface AiInvoiceDraft extends InvoiceFormValues {
  aiSummary: string;
}

export function generateMockAiInvoice(
  prompt: string,
  clients: Client[],
  defaultTemplateId: string
): AiInvoiceDraft {
  const trimmed = prompt.trim();
  const items = matchServices(trimmed);
  const dueDays = inferDueDays(trimmed);
  const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString().split("T")[0];

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxRate = inferTaxRate(trimmed);
  const total = subtotal + (subtotal * taxRate) / 100;

  return {
    clientId: pickClient(clients, trimmed),
    templateId: defaultTemplateId,
    taxRate,
    dueDate,
    notes: trimmed.length > 20
      ? `Generated from: "${trimmed.slice(0, 120)}${trimmed.length > 120 ? "…" : ""}"`
      : "",
    items,
    aiSummary: `Suggested ${items.length} line item${items.length !== 1 ? "s" : ""} totaling ~${total.toLocaleString("en-US", { style: "currency", currency: "USD" })} with ${taxRate}% tax and Net ${dueDays} terms.`,
  };
}
