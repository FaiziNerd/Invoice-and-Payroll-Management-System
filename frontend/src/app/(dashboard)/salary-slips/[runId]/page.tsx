"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Download, FileDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPayrollRunById } from "@/lib/repositories/payroll";
import { getSlipsByRunId, generateSlipsForRun } from "@/lib/repositories/salary-slips";
import { getEmployeeById } from "@/lib/repositories/employees";
import { formatCurrency } from "@/lib/utils";
import { useCompanyDataReady } from "@/hooks/use-storage-data";
import { CardGridSkeleton } from "@/components/shared/skeletons";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";

import type { SalarySlip, Employee } from "@/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SalarySlipsRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const { session } = useAuth();
  const dataReady = useCompanyDataReady();
  const run = getPayrollRunById(runId);
  const [slips, setSlips] = useState<SalarySlip[]>(() => getSlipsByRunId(runId));
  const [downloading, setDownloading] = useState(false);

  if (!dataReady) {
    return <RoleGate roles={["admin", "hr"]}><CardGridSkeleton count={2} /></RoleGate>;
  }

  if (!run) {
    return (
      <RoleGate roles={["admin", "hr"]}>
        <EmptyState
          icon="file"
          title="Payroll run not found"
          description="This payroll run may have been deleted or the link is invalid."
          action={
            <Button asChild>
              <Link href="/salary-slips">Back to Salary Slips</Link>
            </Button>
          }
        />
      </RoleGate>
    );
  }

  if (run.status === "draft") {
    return (
      <RoleGate roles={["admin", "hr"]}>
        <EmptyState
          icon="file"
          title="Payroll not processed yet"
          description="Process this payroll run before generating salary slips."
          action={
            <Button asChild>
              <Link href={`/payroll/${runId}`}>Go to Payroll Run</Link>
            </Button>
          }
        />
      </RoleGate>
    );
  }

  const handleGenerate = async () => {
    if (!session) return;
    try {
      const generated = await generateSlipsForRun(run, session.userId, session.name);
      setSlips(generated);
      toast.success(`Generated ${generated.length} salary slips`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate salary slips");
    }
  };

  const handleDownload = async (slip: SalarySlip) => {
    const emp = getEmployeeById(slip.employeeId);
    if (!emp) return;
    const { downloadSalarySlipPDF } = await import("@/lib/pdf/salary-slip-pdf");
    await downloadSalarySlipPDF(slip, emp);
    toast.success(`Downloaded slip for ${emp.firstName} ${emp.lastName}`);
  };

  const handleBulkDownload = async () => {
    const items = slips
      .map((slip) => {
        const emp = getEmployeeById(slip.employeeId);
        return emp ? { slip, employee: emp } : null;
      })
      .filter((item): item is { slip: SalarySlip; employee: Employee } => item !== null);

    if (items.length === 0) return;

    setDownloading(true);
    try {
      const { downloadSalarySlipsZip } = await import("@/lib/pdf/salary-slip-pdf");
      await downloadSalarySlipsZip(items, `salary-slips-${run.month}-${run.year}.zip`);
      toast.success(`Downloaded ${items.length} salary slips as ZIP`);
    } finally {
      setDownloading(false);
    }
  };

  const displaySlips = slips.length > 0 ? slips : [];

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Salary Slips", href: "/salary-slips" },
            { label: `${MONTHS[run.month - 1]} ${run.year}` },
          ]}
        />
        <PageHeader
          title={`Salary Slips — ${MONTHS[run.month - 1]} ${run.year}`}
          description={`${run.entries.length} employees`}
        >
          <div className="flex gap-2">
            {displaySlips.length === 0 ? (
              <Button onClick={handleGenerate}>
                <FileDown className="h-4 w-4" /> Generate Slips
              </Button>
            ) : (
              <Button variant="outline" onClick={handleBulkDownload} disabled={downloading}>
                <Download className="h-4 w-4" />
                {downloading ? "Downloading..." : "Download All (ZIP)"}
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/salary-slips">Back</Link>
            </Button>
          </div>
        </PageHeader>

        <Card>
          <CardContent className="pt-6">
            {displaySlips.length === 0 ? (
              <EmptyState
                icon="file"
                title="No salary slips generated"
                description="Generate salary slips for all employees in this payroll run."
                action={
                  <Button onClick={handleGenerate}>
                    <FileDown className="h-4 w-4" /> Generate Salary Slips
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {displaySlips.map((slip) => {
                  const emp = getEmployeeById(slip.employeeId);
                  return (
                    <div
                      key={slip.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">
                          {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {emp?.employeeId} · {emp?.position}
                        </p>
                        <div className="mt-1 flex gap-4 text-sm">
                          <span>Gross: {formatCurrency(slip.grossPay)}</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            Net: {formatCurrency(slip.netPay)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Download PDF for ${emp ? `${emp.firstName} ${emp.lastName}` : "employee"}`}
                        onClick={() => handleDownload(slip)}
                      >
                        <Download className="h-4 w-4" /> Download PDF
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
