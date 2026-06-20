import type { Invoice, InvoiceHistoryEntry, InvoiceLineItem, InvoiceStatus } from "@/types";

export interface InvoiceRow {
  id: string;
  company_id: string;
  invoice_number: string;
  client_id: string;
  subtotal: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  total: number | string;
  status: InvoiceStatus;
  template_id: string;
  share_token: string;
  issue_date: string;
  due_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  amount: number | string;
}

export interface InvoiceHistoryRow {
  id: string;
  invoice_id: string;
  action: string;
  timestamp: string;
  user_id: string | null;
  user_name: string | null;
}

export function rowToInvoiceItem(row: InvoiceItemRow): InvoiceLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
  };
}

export function rowToInvoiceHistoryEntry(row: InvoiceHistoryRow): InvoiceHistoryEntry {
  return {
    id: row.id,
    action: row.action,
    timestamp: row.timestamp,
    userId: row.user_id ?? undefined,
    userName: row.user_name ?? undefined,
  };
}

export function rowToInvoice(
  row: InvoiceRow,
  items: InvoiceItemRow[],
  history: InvoiceHistoryRow[]
): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    items: items.map(rowToInvoiceItem),
    subtotal: Number(row.subtotal),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    status: row.status,
    templateId: row.template_id,
    shareToken: row.share_token,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    notes: row.notes ?? undefined,
    history: history.map(rowToInvoiceHistoryEntry),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function invoiceInsertToRow(fields: {
  companyId: string;
  invoiceNumber: string;
  clientId: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  templateId: string;
  shareToken: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
}) {
  return {
    company_id: fields.companyId,
    invoice_number: fields.invoiceNumber,
    client_id: fields.clientId,
    subtotal: fields.subtotal,
    tax_rate: fields.taxRate,
    tax_amount: fields.taxAmount,
    total: fields.total,
    status: fields.status,
    template_id: fields.templateId,
    share_token: fields.shareToken,
    issue_date: fields.issueDate,
    due_date: fields.dueDate,
    notes: fields.notes || null,
  };
}
