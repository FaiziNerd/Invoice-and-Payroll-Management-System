"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login");
    }
  }, [session, isLoading, router]);

  useEffect(() => {
    if (!session || isLoading) return;

    if (session.memberStatus === "pending" && pathname !== "/pending-approval") {
      router.replace("/pending-approval");
      return;
    }

    if (session.role === "employee") {
      const allowed = pathname === "/portal" || pathname.startsWith("/portal/");
      if (!allowed) {
        router.replace("/portal");
      }
    }
  }, [session, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  return <>{children}</>;
}
