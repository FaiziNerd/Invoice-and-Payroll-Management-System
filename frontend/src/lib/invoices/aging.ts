import type { Invoice } from "@/types";

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

export interface AgingBucketData {
  bucket: AgingBucket;
  label: string;
  count: number;
  amount: number;
}

const BUCKET_LABELS: Record<AgingBucket, string> = {
  "0-30": "0–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

export function getAgingBucket(dueDate: string, referenceDate = new Date()): AgingBucket {
  const due = new Date(dueDate);
  const daysPastDue = Math.floor(
    (referenceDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysPastDue <= 30) return "0-30";
  if (daysPastDue <= 60) return "31-60";
  if (daysPastDue <= 90) return "61-90";
  return "90+";
}

export function computeInvoiceAging(invoices: Invoice[]): AgingBucketData[] {
  const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const buckets: Record<AgingBucket, { count: number; amount: number }> = {
    "0-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "61-90": { count: 0, amount: 0 },
    "90+": { count: 0, amount: 0 },
  };

  outstanding.forEach((inv) => {
    const bucket = getAgingBucket(inv.dueDate);
    buckets[bucket].count += 1;
    buckets[bucket].amount += inv.total;
  });

  return (["0-30", "31-60", "61-90", "90+"] as AgingBucket[]).map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    count: buckets[bucket].count,
    amount: buckets[bucket].amount,
  }));
}
