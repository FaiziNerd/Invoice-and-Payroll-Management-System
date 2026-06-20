import type { PayrollStatus } from "@/types";

const STATUS_ORDER: Record<PayrollStatus, number> = {
  draft: 0,
  processed: 1,
  paid: 2,
};

export function payrollStatusRank(status: PayrollStatus): number {
  return STATUS_ORDER[status];
}

export function canProcessPayroll(status: PayrollStatus): boolean {
  return status === "draft";
}

export function canMarkPayrollPaid(status: PayrollStatus): boolean {
  return status === "processed";
}

export function isPayrollAtOrBeyond(
  status: PayrollStatus,
  target: PayrollStatus
): boolean {
  return payrollStatusRank(status) >= payrollStatusRank(target);
}

export function payrollProcessError(status: PayrollStatus): string {
  if (status === "processed") {
    return "Payroll run is already processed";
  }
  if (status === "paid") {
    return "Payroll run is already paid and cannot be processed again";
  }
  return `Cannot process payroll run from status "${status}"`;
}

export function payrollPaidError(status: PayrollStatus): string {
  if (status === "draft") {
    return "Payroll run must be processed before it can be marked as paid";
  }
  if (status === "paid") {
    return "Payroll run is already paid";
  }
  return `Cannot mark payroll run as paid from status "${status}"`;
}
