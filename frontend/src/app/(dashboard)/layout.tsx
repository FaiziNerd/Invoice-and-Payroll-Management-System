"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="md:pl-64">
          <Header />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
