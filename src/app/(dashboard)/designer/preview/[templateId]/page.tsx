"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTemplateById, updateTemplate } from "@/lib/mock-db/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { TemplatePreview } from "@/components/designer/template-preview";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import type { TemplateBranding } from "@/types";

export default function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);
  const router = useRouter();
  const { session } = useAuth();
  const [template, setTemplate] = useState(() => getTemplateById(templateId));

  if (!template) {
    return <p className="text-center py-20">Template not found</p>;
  }

  const { branding } = template;

  const handleActivate = () => {
    if (!session) return;
    const updated = updateTemplate(templateId, { isActive: true }, session.userId, session.name);
    if (updated) {
      setTemplate(updated);
      toast.success("Template published and activated");
      router.push("/designer");
    }
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Preview: {template.name}</h1>
            <div className="flex gap-2 mt-1">
              {!template.isActive && <Badge variant="secondary">Draft — review before publishing</Badge>}
              {template.isActive && <Badge>Active</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/designer/${template.id}`}>Back to Editor</Link>
            </Button>
            {!template.isActive && (
              <Button onClick={handleActivate}>Activate Template</Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Desktop Preview</p>
            <Card>
              <CardContent className="p-8">
                <DetailedInvoicePreview branding={branding} />
              </CardContent>
            </Card>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Mobile Preview</p>
            <Card className="max-w-sm mx-auto">
              <CardContent className="p-4">
                <DetailedInvoicePreview branding={branding} compact />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RoleGate>
  );
}

function DetailedInvoicePreview({
  branding,
  compact = false,
}: {
  branding: TemplateBranding;
  compact?: boolean;
}) {
  return (
    <div style={{ fontFamily: branding.fontFamily }} className={compact ? "text-xs" : "text-sm"}>
      <TemplatePreview branding={branding} compact={compact} />
      <div className="mt-4">
        <p className="text-muted-foreground">Bill To: Sample Client</p>
      </div>
      <table className="w-full mt-2">
        <thead>
          <tr style={{ backgroundColor: branding.primaryColor }} className="text-white">
            <th className="p-1 text-left">Item</th>
            <th className="p-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b"><td className="p-1">Web Development</td><td className="p-1 text-right">{formatCurrency(5000)}</td></tr>
          <tr className="border-b"><td className="p-1">Design Services</td><td className="p-1 text-right">{formatCurrency(2000)}</td></tr>
        </tbody>
      </table>
      <div className="mt-4 text-right font-bold" style={{ color: branding.primaryColor }}>
        Total: {formatCurrency(7000)}
      </div>
    </div>
  );
}
