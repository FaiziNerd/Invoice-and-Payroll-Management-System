"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPayrollRun, getPayrollRunByMonth } from "@/lib/mock-db/payroll";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function RunPayrollPage() {
  const router = useRouter();
  const { session } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const handleRun = () => {
    if (!session) return;
    if (getPayrollRunByMonth(month, year)) {
      toast.error("Payroll already exists for this period");
      return;
    }
    const run = createPayrollRun(month, year, session.userId, session.name);
    if (run) {
      toast.success("Payroll run created");
      router.push(`/payroll/${run.id}`);
    }
  };

  return (
    <RoleGate roles={["admin", "accountant", "hr"]}>
      <div className="space-y-6">
        <PageHeader title="Run Payroll" description="Process monthly payroll for all active employees" />

        <Card className="max-w-md">
          <CardHeader><CardTitle>Select Period</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleRun}>Create Payroll Run</Button>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
