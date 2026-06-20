"use client";

import { useEffect, useState } from "react";

type DashboardAnalytics = {
  totalRevenue: number;
  outstanding: number;
  totalPayroll: number;
  netMargin: number;
  revenueMoM: number | null;
  outstandingMoM: number | null;
  payrollMoM: number | null;
  marginMoM: number | null;
  monthTotals: Array<{
    key: string;
    label: string;
    revenue: number;
    payroll: number;
    margin: number;
  }>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  netMarginTrend: Array<{ month: string; margin: number }>;
  invoiceStatusData: Array<{ name: string; value: number }>;
  agingData: Array<{ bucket: string; label: string; count: number; amount: number }>;
  payrollTrend: Array<{ month: string; expense: number }>;
  deptChartData: Array<{ name: string; value: number }>;
  insights: Array<{ id: string; text: string; type: "warning" | "info" | "success" }>;
  reminderCandidates: Array<{
    id: string;
    invoiceNumber: string;
    clientId: string;
    total: number;
    status: string;
    dueDate: string;
  }>;
  outstandingExportRows: Array<{
    id: string;
    invoiceNumber: string;
    clientId: string;
    amount: number;
    status: string;
    dueDate: string;
  }>;
};

export function useDashboardAnalytics(enabled: boolean) {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard/analytics", { credentials: "include" });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to load dashboard analytics");
        }
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard analytics");
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [enabled]);

  return { data, loading, error };
}

export type { DashboardAnalytics };
