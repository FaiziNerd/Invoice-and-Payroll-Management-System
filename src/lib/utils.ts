import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function getDaysOverdue(dueDate: string | Date): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}
