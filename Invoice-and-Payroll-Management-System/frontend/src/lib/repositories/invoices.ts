import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/types";
import { notifyDataChange } from "@/lib/data/events";
import { addAuditLog } from "@/lib/repositories/audit";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

type SharedInvoicePayload = {
  invoice: {
    id: string;
    invoice_number: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    status: InvoiceStatus;
    issue_date: string;
    due_date: string;
    notes?: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
};

let invoicesCache: Invoice[] = [];

async function parseApi<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResult<T>;
  if (!json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

function upsertInvoice(invoice: Invoice): void {
  const index = invoicesCache.findIndex((item) => item.id === invoice.id);
  if (index === -1) {
    invoicesCache = [invoice, ...invoicesCache];
  } else {
    invoicesCache = invoicesCache.map((item) =>
      item.id === invoice.id ? invoice : item
    );
  }
}

export async function loadInvoicesFromApi(): Promise<Invoice[]> {
  const res = await fetch("/api/invoices", { credentials: "include" });
  if (!res.ok) {
    invoicesCache = [];
    return invoicesCache;
  }
  invoicesCache = await parseApi<Invoice[]>(res);
  notifyDataChange("invoices");
  return invoicesCache;
}

export async function resolveOverdueInvoicesFromApi(): Promise<number> {
  const res = await fetch("/api/invoices/resolve-overdue", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    return 0;
  }
  const json = (await res.json()) as ApiResult<{ promoted: number }>;
  if (!json.success) {
    return 0;
  }
  return json.data.promoted;
}

export function getInvoices(): Invoice[] {
  return invoicesCache;
}

export function getInvoiceById(id: string): Invoice | undefined {
  return invoicesCache.find((invoice) => invoice.id === id);
}

export async function fetchInvoiceById(id: string): Promise<Invoice | undefined> {
  const cached = getInvoiceById(id);
  if (cached) return cached;

  const res = await fetch(`/api/invoices/${id}`, { credentials: "include" });
  if (!res.ok) return undefined;

  const invoice = await parseApi<Invoice>(res);
  upsertInvoice(invoice);
  notifyDataChange("invoices");
  return invoice;
}

export async function getInvoiceByToken(token: string): Promise<Invoice | undefined> {
  const res = await fetch(`/api/shared/invoice/${encodeURIComponent(token)}`, {
    credentials: "include",
  });
  if (!res.ok) return undefined;

  const payload = await parseApi<SharedInvoicePayload>(res);
  const invoice = payload?.invoice;
  if (!invoice) return undefined;

  const items = Array.isArray(payload.items)
    ? payload.items.map((item) => ({
        id: String(item.id),
        description: String(item.description ?? ""),
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unit_price ?? 0),
        amount: Number(item.amount ?? 0),
      }))
    : [];

  return {
    id: String(invoice.id),
    invoiceNumber: String(invoice.invoice_number),
    clientId: "",
    items,
    subtotal: Number(invoice.subtotal ?? 0),
    taxRate: Number(invoice.tax_rate ?? 0),
    taxAmount: Number(invoice.tax_amount ?? 0),
    total: Number(invoice.total ?? 0),
    status: invoice.status as InvoiceStatus,
    templateId: "",
    shareToken: token,
    issueDate: String(invoice.issue_date),
    dueDate: String(invoice.due_date),
    notes: invoice.notes ?? undefined,
    history: [],
    createdAt: String(invoice.issue_date),
    updatedAt: String(invoice.issue_date),
  };
}

export function calculateInvoiceTotals(items: InvoiceLineItem[], taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export async function createInvoice(
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
): Promise<Invoice> {
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      ...data,
      userName,
      historyAction: "Invoice created",
    }),
  });

  const invoice = await parseApi<Invoice>(res);
  upsertInvoice(invoice);
  notifyDataChange("invoices");

  void addAuditLog({
    action: "create",
    entity: "invoice",
    entityId: invoice.id,
    userId,
    userName,
    description: `Created invoice ${invoice.invoiceNumber}`,
  });

  return invoice;
}

export async function updateInvoice(
  id: string,
  data: Partial<Invoice>,
  userId: string,
  userName: string,
  historyAction?: string
): Promise<Invoice | null> {
  const res = await fetch(`/api/invoices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      ...data,
      userName,
      historyAction,
    }),
  });

  if (res.status === 404) return null;

  const invoice = await parseApi<Invoice>(res);
  upsertInvoice(invoice);
  notifyDataChange("invoices");

  void addAuditLog({
    action: "update",
    entity: "invoice",
    entityId: id,
    userId,
    userName,
    description: historyAction || `Updated invoice ${invoice.invoiceNumber}`,
  });

  return invoice;
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  userId: string,
  userName: string
): Promise<Invoice | null> {
  const statusRes = await fetch(`/api/invoices/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status, userName }),
  });

  if (statusRes.status === 404) return null;
  await parseApi<{ id: string; status: InvoiceStatus }>(statusRes);

  const invoiceRes = await fetch(`/api/invoices/${id}`, { credentials: "include" });
  if (!invoiceRes.ok) return null;
  const invoice = await parseApi<Invoice>(invoiceRes);
  upsertInvoice(invoice);
  notifyDataChange("invoices");

  void addAuditLog({
    action: "status_change",
    entity: "invoice",
    entityId: id,
    userId,
    userName,
    description: `Status changed to ${status}`,
  });

  return invoice;
}

export async function deleteInvoice(
  id: string,
  userId: string,
  userName: string
): Promise<boolean> {
  const invoice = getInvoiceById(id);
  const res = await fetch(`/api/invoices/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const parsed = await parseApi<{ deleted: true }>(res);
  if (!parsed.deleted) return false;

  invoicesCache = invoicesCache.filter((item) => item.id !== id);
  notifyDataChange("invoices");

  void addAuditLog({
    action: "delete",
    entity: "invoice",
    entityId: id,
    userId,
    userName,
    description: `Deleted invoice ${invoice?.invoiceNumber ?? id}`,
  });

  return true;
}

export function getNextInvoiceNumber(): string {
  const max = invoicesCache.reduce((acc, invoice) => {
    const match = /^INV-(\d+)$/i.exec(invoice.invoiceNumber.trim());
    if (!match) return acc;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? Math.max(acc, parsed) : acc;
  }, 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

export async function sendInvoiceEmail(
  id: string,
  userId: string,
  userName: string,
  clientEmail: string,
  mode: "send" | "resend" | "reminder"
): Promise<Invoice | null> {
  const res = await fetch(`/api/invoices/${id}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode, userName }),
  });

  if (res.status === 404) return null;

  const invoice = await parseApi<Invoice>(res);
  upsertInvoice(invoice);
  notifyDataChange("invoices");

  return invoice;
}

export function getInvoicesNeedingReminder(): Invoice[] {
  return invoicesCache.filter(
    (invoice) => invoice.status === "sent" || invoice.status === "overdue"
  );
}
