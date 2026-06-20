"use client";

import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/types";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface RoleGateProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ roles, children, fallback }: RoleGateProps) {
  const { hasRole } = useAuth();

  if (!hasRole(...roles)) {
    return (
      fallback ?? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="mt-2 text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      )
    );
  }

  return <>{children}</>;
}
