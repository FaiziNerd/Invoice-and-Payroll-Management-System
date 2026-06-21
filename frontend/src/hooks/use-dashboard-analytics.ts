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
  payrollInsights: Array<{ id: string; text: string; type: "warning" | "info" | "success" }>;
  payrollInsightsSource: "ai" | "rules";
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
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch("/api/dashboard/analytics", { credentials: "include" });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to load dashboard analytics");
        }
        if (!cancelled) {
          setData(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard analytics");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !data) return;

    let cancelled = false;
    setAiInsightsLoading(true);

    void (async () => {
      try {
        const res = await fetch("/api/dashboard/payroll-insights-ai", {
          credentials: "include",
        });
        const json = await res.json();
        if (cancelled || !json.success) return;

        const aiInsights = json.data?.insights as DashboardAnalytics["payrollInsights"] | null;
        if (aiInsights?.length && json.data?.source === "ai") {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  payrollInsights: aiInsights,
                  payrollInsightsSource: "ai",
                }
              : prev
          );
        }
      } catch {
        // Keep rule-based insights already shown
      } finally {
        if (!cancelled) {
          setAiInsightsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, data?.totalRevenue, data?.totalPayroll]);

  return { data, loading, error, aiInsightsLoading };
}

export type { DashboardAnalytics };
