"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import type { InvoiceFormValues } from "@/components/invoices/invoice-form";
import { createInvoice, getNextInvoiceNumber } from "@/lib/mock-db/invoices";
import { getDefaultTemplate } from "@/lib/mock-db/templates";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";

export default function NewInvoicePage() {
  const router = useRouter();
  const { session } = useAuth();
  const defaultTemplate = getDefaultTemplate();

  const handleSubmit = (values: InvoiceFormValues) => {
    if (!session || !values.clientId) {
      toast.error("Please select a client");
      return;
    }
    if (values.items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    const invoice = createInvoice(
      {
        invoiceNumber: getNextInvoiceNumber(),
        clientId: values.clientId,
        items: values.items,
        taxRate: values.taxRate,
        status: "draft",
        templateId: values.templateId || defaultTemplate?.id || "",
        issueDate: new Date().toISOString(),
        dueDate: new Date(values.dueDate).toISOString(),
        notes: values.notes,
      },
      session.userId,
      session.name
    );
    toast.success("Invoice created");
    router.push(`/invoices/${invoice.id}`);
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <PageHeader title="New Invoice" description="Create a new invoice" />
        <InvoiceForm
          submitLabel="Create Invoice"
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </RoleGate>
  );
}
