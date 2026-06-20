"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceForm, invoiceToFormValues } from "@/components/invoices/invoice-form";
import type { InvoiceFormValues } from "@/components/invoices/invoice-form";
import { getInvoiceById, updateInvoice } from "@/lib/mock-db/invoices";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { session } = useAuth();
  const invoice = useMemo(() => getInvoiceById(id), [id]);

  if (!invoice) {
    return <p className="text-center py-20 text-muted-foreground">Invoice not found</p>;
  }

  if (invoice.status === "paid") {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Paid invoices cannot be edited.</p>
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => router.push(`/invoices/${id}`)}
        >
          Back to invoice
        </button>
      </div>
    );
  }

  const handleSubmit = (values: InvoiceFormValues) => {
    if (!session || !values.clientId) {
      toast.error("Please select a client");
      return;
    }
    if (values.items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    updateInvoice(
      id,
      {
        clientId: values.clientId,
        templateId: values.templateId,
        items: values.items,
        taxRate: values.taxRate,
        dueDate: new Date(values.dueDate).toISOString(),
        notes: values.notes,
      },
      session.userId,
      session.name,
      "Invoice updated"
    );
    toast.success("Invoice updated");
    router.push(`/invoices/${id}`);
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <PageHeader
          title={`Edit ${invoice.invoiceNumber}`}
          description="Update invoice details and line items"
        />
        <InvoiceForm
          initialValues={invoiceToFormValues(invoice)}
          submitLabel="Save Changes"
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/invoices/${id}`)}
        />
      </div>
    </RoleGate>
  );
}
