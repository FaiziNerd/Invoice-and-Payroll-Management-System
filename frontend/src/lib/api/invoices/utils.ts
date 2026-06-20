import type { Invoice, InvoiceHistoryEntry, InvoiceLineItem, InvoiceStatus } from "@/types";
import { generateId } from "@/lib/utils";

export const OVERDUE_HISTORY_ACTION = "Status changed to overdue";

export function calculateInvoiceTotals(items: InvoiceLineItem[], taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export function normalizeLineItems(
  items: Array<Omit<InvoiceLineItem, "id"> & { id?: string }>
): InvoiceLineItem[] {
  return items.map((item) => ({
    ...item,
    id: item.id ?? generateId(),
  }));
}

function hasOverdueHistoryEntry(invoice: Invoice): boolean {
  return invoice.history.some((entry) => entry.action === OVERDUE_HISTORY_ACTION);
}

export function resolveOverdue(invoice: Invoice): Invoice | null {
  const isPastDue = new Date(invoice.dueDate) < new Date();
  if (!isPastDue) return null;
  if (invoice.status !== "sent" && invoice.status !== "overdue") return null;
  if (invoice.status === "overdue" && hasOverdueHistoryEntry(invoice)) return null;

  const historyEntry: InvoiceHistoryEntry = {
    id: generateId(),
    action: OVERDUE_HISTORY_ACTION,
    timestamp: new Date().toISOString(),
    userId: "system",
    userName: "System",
  };

  return {
    ...invoice,
    status: "overdue" as InvoiceStatus,
    history: [historyEntry, ...invoice.history],
    updatedAt: new Date().toISOString(),
  };
}
