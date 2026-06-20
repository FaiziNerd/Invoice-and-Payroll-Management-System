/**
 * Unit tests for payroll status guards (no DB required).
 * Usage: node scripts/test-payroll-status.mjs
 */

const STATUS_ORDER = { draft: 0, processed: 1, paid: 2 };

function payrollStatusRank(status) {
  return STATUS_ORDER[status];
}

function canProcessPayroll(status) {
  return status === "draft";
}

function canMarkPayrollPaid(status) {
  return status === "processed";
}

function isPayrollAtOrBeyond(status, target) {
  return payrollStatusRank(status) >= payrollStatusRank(target);
}

function payrollPaidError(status) {
  if (status === "draft") {
    return "Payroll run must be processed before it can be marked as paid";
  }
  if (status === "paid") {
    return "Payroll run is already paid";
  }
  return `Cannot mark payroll run as paid from status "${status}"`;
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

assert(canProcessPayroll("draft"), "draft should be processable");
assert(!canProcessPayroll("processed"), "processed should not re-process via guard");
assert(!canMarkPayrollPaid("draft"), "draft cannot be marked paid");
assert(canMarkPayrollPaid("processed"), "processed can be marked paid");
assert(isPayrollAtOrBeyond("paid", "processed"), "paid is beyond processed");
assert(
  payrollPaidError("draft").includes("processed"),
  "draft paid error should mention processed"
);

console.log("Payroll status unit tests passed.");
