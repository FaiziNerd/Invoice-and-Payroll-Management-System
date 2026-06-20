"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Download, FileDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPayrollRunById } from "@/lib/mock-db/payroll";
import { getSlipsByRunId, generateSlipsForRun } from "@/lib/mock-db/salary-slips";
import { getEmployeeById } from "@/lib/mock-db/employees";
import { downloadSalarySlipPDF, downloadSalarySlipsZip } from "@/lib/pdf/salary-slip-pdf";
import { formatCurrency } from "@/lib/utils";
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
  const run = getPayrollRunById(runId);
  const [slips, setSlips] = useState<SalarySlip[]>(() => getSlipsByRunId(runId));
  const [downloading, setDownloading] = useState(false);

  if (!run) {
    return <p className="text-center py-20 text-muted-foreground">Payroll run not found</p>;
  }

  if (run.status === "draft") {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">Process this payroll run before generating salary slips.</p>
        <Button asChild><Link href={`/payroll/${runId}`}>Go to Payroll Run</Link></Button>
      </div>
    );
  }

  const handleGenerate = () => {
    if (!session) return;
    const generated = generateSlipsForRun(run, session.userId, session.name);
    setSlips(generated);
    toast.success(`Generated ${generated.length} salary slips`);
  };

  const handleDownload = async (slip: SalarySlip) => {
    const emp = getEmployeeById(slip.employeeId);
    if (!emp) return;
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
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No salary slips generated yet for this period.</p>
                <Button onClick={handleGenerate}>Generate Salary Slips</Button>
              </div>
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
                          <span className="font-semibold text-emerald-600">
                            Net: {formatCurrency(slip.netPay)}
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(slip)}>
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
