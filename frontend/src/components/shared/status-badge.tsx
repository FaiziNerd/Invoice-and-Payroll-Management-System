import { cn } from "@/lib/utils";
import type { InvoiceStatus, PayrollStatus } from "@/types";

type StatusChipConfig = {
  label: string;
  dot: string;
  chip: string;
};

const invoiceStatusMap: Record<InvoiceStatus, StatusChipConfig> = {
  draft: {
    label: "Draft",
    dot: "bg-zinc-400 dark:bg-zinc-500",
    chip: "border-zinc-200/80 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300",
  },
  sent: {
    label: "Sent",
    dot: "bg-blue-500",
    chip: "border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  },
  partially_paid: {
    label: "Partially Paid",
    dot: "bg-amber-500",
    chip: "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  paid: {
    label: "Paid",
    dot: "bg-emerald-500",
    chip: "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  overdue: {
    label: "Overdue",
    dot: "bg-red-500 animate-pulse",
    chip: "border-red-200/80 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  },
  void: {
    label: "Void",
    dot: "bg-zinc-400 dark:bg-zinc-600",
    chip: "border-zinc-200/80 bg-zinc-50 text-zinc-500 line-through dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-500",
  },
};

const payrollStatusMap: Record<PayrollStatus, StatusChipConfig> = {
  draft: {
    label: "Draft",
    dot: "bg-zinc-400 dark:bg-zinc-500",
    chip: "border-zinc-200/80 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300",
  },
  processed: {
    label: "Processed",
    dot: "bg-violet-500",
    chip: "border-violet-200/80 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  },
  paid: {
    label: "Paid",
    dot: "bg-emerald-500",
    chip: "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

function StatusChip({ config }: { config: StatusChipConfig }) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        config.chip
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <StatusChip config={invoiceStatusMap[status]} />;
}

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return <StatusChip config={payrollStatusMap[status]} />;
}
