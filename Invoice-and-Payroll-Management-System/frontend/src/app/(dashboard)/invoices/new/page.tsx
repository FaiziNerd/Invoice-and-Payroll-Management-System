"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import type { InvoiceFormValues } from "@/components/invoices/invoice-form";
import { QuickDraftGenerator } from "@/components/invoices/quick-draft-generator";
import { createInvoice } from "@/lib/repositories/invoices";
import { getDefaultTemplate } from "@/lib/repositories/templates";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";

export default function NewInvoicePage() {
  const router = useRouter();
  const { session } = useAuth();
  const defaultTemplate = getDefaultTemplate();
  const [formKey, setFormKey] = useState(0);
  const [draftValues, setDraftValues] = useState<Partial<InvoiceFormValues> | undefined>();
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>("");

  useEffect(() => {
    fetch("/api/invoices/next-number", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.data?.invoiceNumber) setNextInvoiceNumber(d.data.invoiceNumber); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (values: InvoiceFormValues) => {
    if (!session || !values.clientId) {
      toast.error("Please select a client");
      return;
    }
    if (values.items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    if (!nextInvoiceNumber) {
      toast.error("Invoice number not ready yet, please try again in a moment");
      return;
    }
    try {
      const invoice = await createInvoice(
        {
          invoiceNumber: nextInvoiceNumber,
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    }
  };

  const handleQuickDraftGenerated = (values: InvoiceFormValues, summary: string) => {
    setDraftValues(values);
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
        <QuickDraftGenerator onGenerated={handleQuickDraftGenerated} />
        <InvoiceForm
          key={formKey}
          initialValues={draftValues}
          submitLabel="Create Invoice"
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </RoleGate>
  );
}
