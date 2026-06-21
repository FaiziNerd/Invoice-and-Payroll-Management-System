"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTransition } from "@/components/shared/page-transition";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen surface-app">
        <Sidebar />
        <div className="md:pl-64">
          <Header />
          <main className="p-4 md:p-6">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
