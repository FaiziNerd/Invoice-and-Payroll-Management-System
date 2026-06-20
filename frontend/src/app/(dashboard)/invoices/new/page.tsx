"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import type { InvoiceFormValues } from "@/components/invoices/invoice-form";
import { AiInvoiceGenerator } from "@/components/invoices/ai-invoice-generator";
import { createInvoice, getNextInvoiceNumber } from "@/lib/mock-db/invoices";
import { getDefaultTemplate } from "@/lib/mock-db/templates";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";

export default function NewInvoicePage() {
  const router = useRouter();
  const { session } = useAuth();
  const defaultTemplate = getDefaultTemplate();
  const [formKey, setFormKey] = useState(0);
  const [aiValues, setAiValues] = useState<Partial<InvoiceFormValues> | undefined>();

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

  const handleAiGenerated = (values: InvoiceFormValues, summary: string) => {
    setAiValues(values);
    setFormKey((k) => k + 1);
    toast.success(summary);
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Invoices", href: "/invoices" },
            { label: "New Invoice" },
          ]}
        />
        <PageHeader title="New Invoice" description="Create a new invoice" />
        <AiInvoiceGenerator onGenerated={handleAiGenerated} />
        <InvoiceForm
          key={formKey}
          initialValues={aiValues}
          submitLabel="Create Invoice"
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </RoleGate>
  );
}
