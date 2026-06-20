import { getFromStorage, setInStorage } from "./storage";
import type { Invoice, InvoiceStatus, InvoiceLineItem } from "@/types";
import { generateId, generateShareToken } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";

const KEY = "invoices";

export function getInvoices(): Invoice[] {
  const invoices = getFromStorage<Invoice[]>(KEY, []);
  return resolveOverdueStatuses(invoices);
}

function resolveOverdueStatuses(invoices: Invoice[]): Invoice[] {
  let changed = false;
  const updated = invoices.map((invoice) => {
    if (invoice.status === "sent" && new Date(invoice.dueDate) < new Date()) {
      changed = true;
      return {
        ...invoice,
        status: "overdue" as InvoiceStatus,
        history: [
          {
            id: generateId(),
            action: "Status changed to overdue",
            timestamp: new Date().toISOString(),
            userId: "system",
            userName: "System",
          },
          ...invoice.history,
        ],
      };
    }
    return invoice;
  });
  if (changed) setInStorage(KEY, updated);
  return updated;
}

export function getInvoiceById(id: string): Invoice | undefined {
  return getInvoices().find((i) => i.id === id);
}

export function getInvoiceByToken(token: string): Invoice | undefined {
  return getInvoices().find((i) => i.shareToken === token);
}

export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  taxRate: number
) {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export function createInvoice(
  data: Omit<
    Invoice,
    | "id"
    | "shareToken"
    | "history"
    | "createdAt"
    | "updatedAt"
    | "subtotal"
    | "taxAmount"
    | "total"
  > & { items: InvoiceLineItem[] },
  userId: string,
  userName: string
): Invoice {
  const totals = calculateInvoiceTotals(data.items, data.taxRate);
  const invoice: Invoice = {
    ...data,
    ...totals,
    id: generateId(),
    shareToken: generateShareToken(),
    history: [
      {
        id: generateId(),
        action: "Invoice created",
        timestamp: new Date().toISOString(),
        userId,
        userName,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const invoices = getFromStorage<Invoice[]>(KEY, []);
  invoices.push(invoice);
  setInStorage(KEY, invoices);
  addAuditLog({
    action: "create",
    entity: "invoice",
    entityId: invoice.id,
    userId,
    userName,
    description: `Created invoice ${invoice.invoiceNumber}`,
  });
  return invoice;
}

export function updateInvoice(
  id: string,
  data: Partial<Invoice>,
  userId: string,
  userName: string,
  historyAction?: string
): Invoice | null {
  const invoices = getFromStorage<Invoice[]>(KEY, []);
  const index = invoices.findIndex((i) => i.id === id);
  if (index === -1) return null;

  let updated = { ...invoices[index], ...data, updatedAt: new Date().toISOString() };

  if (data.items || data.taxRate !== undefined) {
    const totals = calculateInvoiceTotals(
      updated.items,
      updated.taxRate
    );
    updated = { ...updated, ...totals };
  }

  if (historyAction) {
    updated.history = [
      {
        id: generateId(),
        action: historyAction,
        timestamp: new Date().toISOString(),
        userId,
        userName,
      },
      ...updated.history,
    ];
  }

  invoices[index] = updated;
  setInStorage(KEY, invoices);
  addAuditLog({
    action: "update",
    entity: "invoice",
    entityId: id,
    userId,
    userName,
    description: historyAction || `Updated invoice ${updated.invoiceNumber}`,
  });
  return updated;
}

export function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  userId: string,
  userName: string
): Invoice | null {
  return updateInvoice(
    id,
    { status },
    userId,
    userName,
    `Status changed to ${status}`
  );
}

export function deleteInvoice(
  id: string,
  userId: string,
  userName: string
): boolean {
  const invoices = getFromStorage<Invoice[]>(KEY, []);
  const invoice = invoices.find((i) => i.id === id);
  if (!invoice) return false;
  setInStorage(
    KEY,
    invoices.filter((i) => i.id !== id)
  );
  addAuditLog({
    action: "delete",
    entity: "invoice",
    entityId: id,
    userId,
    userName,
    description: `Deleted invoice ${invoice.invoiceNumber}`,
  });
  return true;
}

export function getNextInvoiceNumber(): string {
  const invoices = getInvoices();
  const num = invoices.length + 1;
  return `INV-${String(num).padStart(4, "0")}`;
}
