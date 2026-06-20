import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus, PayrollStatus } from "@/types";

const invoiceStatusMap: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  partially_paid: { label: "Partially Paid", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
};

const payrollStatusMap: Record<PayrollStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" }> = {
  draft: { label: "Draft", variant: "secondary" },
  processed: { label: "Processed", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config = invoiceStatusMap[status];
  return <Badge role="status" variant={config.variant}>{config.label}</Badge>;
}

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  const config = payrollStatusMap[status];
  return <Badge role="status" variant={config.variant}>{config.label}</Badge>;
}
