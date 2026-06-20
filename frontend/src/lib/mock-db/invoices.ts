import { getFromStorage, setInStorage, getAllCompanyIds } from "./storage";
import type { Invoice, InvoiceStatus, InvoiceLineItem } from "@/types";
import { generateId, generateShareToken } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";

const KEY = "invoices";

export function getInvoices(): Invoice[] {
  const invoices = getFromStorage<Invoice[]>(KEY, []);
  return resolveOverdueStatuses(invoices);
}

const OVERDUE_HISTORY_ACTION = "Status changed to overdue";

function hasOverdueHistoryEntry(invoice: Invoice): boolean {
  return invoice.history.some((entry) => entry.action === OVERDUE_HISTORY_ACTION);
}

function appendOverdueHistory(invoice: Invoice): Invoice {
  return {
    ...invoice,
    status: "overdue" as InvoiceStatus,
    history: [
      {
        id: generateId(),
        action: OVERDUE_HISTORY_ACTION,
        timestamp: new Date().toISOString(),
        userId: "system",
        userName: "System",
      },
      ...invoice.history,
    ],
    updatedAt: new Date().toISOString(),
  };
}

function resolveOverdueStatuses(invoices: Invoice[], companyId?: string): Invoice[] {
  let changed = false;
  const updated = invoices.map((invoice) => {
    const isPastDue = new Date(invoice.dueDate) < new Date();

    if (invoice.status === "sent" && isPastDue) {
      changed = true;
      return appendOverdueHistory(invoice);
    }

    if (invoice.status === "overdue" && isPastDue && !hasOverdueHistoryEntry(invoice)) {
      changed = true;
      return appendOverdueHistory(invoice);
    }

    return invoice;
  });
  if (changed) setInStorage(KEY, updated, companyId);
  return updated;
}

export function getInvoiceById(id: string): Invoice | undefined {
  return getInvoices().find((i) => i.id === id);
}

export function getInvoiceByToken(token: string): Invoice | undefined {
  for (const companyId of getAllCompanyIds()) {
    const invoices = getFromStorage<Invoice[]>(KEY, [], companyId);
    const found = resolveOverdueStatuses(invoices, companyId).find((i) => i.shareToken === token);
    if (found) return found;
  }
  return undefined;
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

export function sendInvoiceEmail(
  id: string,
  userId: string,
  userName: string,
  clientEmail: string,
  mode: "send" | "resend" | "reminder"
): Invoice | null {
  const historyMessages: Record<typeof mode, string> = {
    send: `Invoice sent to ${clientEmail} (mock)`,
    resend: `Invoice resent to ${clientEmail} (mock)`,
    reminder: `Payment reminder sent to ${clientEmail} (mock)`,
  };

  const updates: Partial<Invoice> = {};
  if (mode === "send") {
    updates.status = "sent";
  }

  const invoice = updateInvoice(
    id,
    updates,
    userId,
    userName,
    historyMessages[mode]
  );

  if (invoice) {
    const descriptions: Record<typeof mode, string> = {
      send: `Sent invoice ${invoice.invoiceNumber} to ${clientEmail} (mock)`,
      resend: `Resent invoice ${invoice.invoiceNumber} to ${clientEmail} (mock)`,
      reminder: `Sent payment reminder for ${invoice.invoiceNumber} to ${clientEmail} (mock)`,
    };
    addAuditLog({
      action: "send",
      entity: "invoice",
      entityId: id,
      userId,
      userName,
      description: descriptions[mode],
      metadata: { email: clientEmail, mode },
    });
  }

  return invoice;
}

export function getInvoicesNeedingReminder(): Invoice[] {
  return getInvoices().filter(
    (inv) => inv.status === "sent" || inv.status === "overdue"
  );
}
