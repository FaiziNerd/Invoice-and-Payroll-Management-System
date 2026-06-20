"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getClients } from "@/lib/mock-db/clients";
import { getActiveTemplates } from "@/lib/mock-db/templates";
import { generateId } from "@/lib/utils";
import { Plus, Trash2, X } from "lucide-react";
import type { Client, Invoice, InvoiceLineItem } from "@/types";

export interface InvoiceFormValues {
  clientId: string;
  templateId: string;
  taxRate: number;
  dueDate: string;
  notes: string;
  items: InvoiceLineItem[];
}

interface InvoiceFormProps {
  initialValues?: Partial<InvoiceFormValues>;
  submitLabel: string;
  onSubmit: (values: InvoiceFormValues) => void;
  onCancel: () => void;
}

const defaultItem = (): InvoiceLineItem => ({
  id: generateId(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  amount: 0,
});

export function InvoiceForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: InvoiceFormProps) {
  const clients = getClients();
  const templates = getActiveTemplates();

  const [clientId, setClientId] = useState(initialValues?.clientId || "");
  const [templateId, setTemplateId] = useState(
    initialValues?.templateId || templates.find((t) => t.isDefault)?.id || templates[0]?.id || ""
  );
  const [taxRate, setTaxRate] = useState(initialValues?.taxRate ?? 10);
  const [dueDate, setDueDate] = useState(
    initialValues?.dueDate ||
      new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState(initialValues?.notes || "");
  const [items, setItems] = useState<InvoiceLineItem[]>(
    initialValues?.items?.length ? initialValues.items : [defaultItem()]
  );

  const [clientError, setClientError] = useState("");
  const [itemsError, setItemsError] = useState("");

  const updateItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setItemsError("");
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.amount = updated.quantity * updated.unitPrice;
        }
        return updated;
      })
    );
  };

  const addItem = () => setItems((prev) => [...prev, defaultItem()]);
  const removeItem = (id: string) => {
    if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!clientId) {
      setClientError("Please select a client");
      valid = false;
    }

    const validItems = items.filter((i) => i.description.trim() && i.amount > 0);
    if (validItems.length === 0) {
      setItemsError("Add at least one line item with a description and amount greater than zero");
      valid = false;
    }

    if (!valid) return;

    onSubmit({ clientId, templateId, taxRate, dueDate, notes, items: validItems });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="inv-client">Client</Label>
            <Select
              value={clientId}
              onValueChange={(v) => { setClientId(v); setClientError(""); }}
            >
              <SelectTrigger id="inv-client" className={clientError ? "border-destructive" : ""}>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c: Client) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <X className="h-3 w-3" />{clientError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-template">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="inv-template"><SelectValue placeholder="Select template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-due-date">Due Date</Label>
            <Input id="inv-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-tax-rate">Tax Rate (%)</Label>
            <Input id="inv-tax-rate" type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {itemsError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <X className="h-3 w-3" />{itemsError}
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 sm:grid-cols-12 items-end">
              <div className="sm:col-span-5 space-y-1">
                <Label htmlFor={`item-${item.id}-desc`}>Description</Label>
                <Input
                  id={`item-${item.id}-desc`}
                  value={item.description}
                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  placeholder="Service description"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor={`item-${item.id}-qty`}>Qty</Label>
                <Input
                  id={`item-${item.id}-qty`}
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor={`item-${item.id}-price`}>Price</Label>
                <Input
                  id={`item-${item.id}-price`}
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor={`item-${item.id}-amount`}>Amount</Label>
                <Input id={`item-${item.id}-amount`} value={item.amount.toFixed(2)} readOnly />
              </div>
              <div className="sm:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line item"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export function invoiceToFormValues(invoice: Invoice): InvoiceFormValues {
  return {
    clientId: invoice.clientId,
    templateId: invoice.templateId,
    taxRate: invoice.taxRate,
    dueDate: invoice.dueDate.split("T")[0],
    notes: invoice.notes || "",
    items: invoice.items,
  };
}
