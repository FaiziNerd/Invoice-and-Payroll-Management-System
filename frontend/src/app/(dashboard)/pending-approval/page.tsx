"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function PendingApprovalPage() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    if (session.memberStatus === "active") {
      router.replace(session.role === "employee" ? "/portal" : "/dashboard");
    }
  }, [session, router]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending approval"
        description="Your access request is waiting for a company admin to approve it."
      />
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          You can sign in, but you cannot access company data until an administrator approves
          your account from the Users admin page.
        </CardContent>
      </Card>
    </div>
  );
}
