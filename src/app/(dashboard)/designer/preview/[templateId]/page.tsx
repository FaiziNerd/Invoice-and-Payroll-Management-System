"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTemplateById, publishTemplate } from "@/lib/mock-db/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { TemplatePreview } from "@/components/designer/template-preview";
import { PublishFlowSteps } from "@/components/designer/publish-flow-steps";
import { MobilePreviewFrame } from "@/components/designer/mobile-preview-frame";
import { EmptyState } from "@/components/shared/empty-state";
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
  const [showActivateDialog, setShowActivateDialog] = useState(false);

  if (!template) {
    return (
      <RoleGate roles={["admin", "accountant"]}>
        <EmptyState
          icon="palette"
          title="Template not found"
          description="This template may have been deleted or the link is invalid."
          action={
            <Button asChild>
              <Link href="/designer">Back to Designer</Link>
            </Button>
          }
        />
      </RoleGate>
    );
  }

  const { branding } = template;

  const handleActivate = () => {
    if (!session) return;
    const updated = publishTemplate(templateId, session.userId, session.name);
    if (updated) {
      setTemplate(updated);
      setShowActivateDialog(false);
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
              <Button onClick={() => setShowActivateDialog(true)}>Activate Template</Button>
            )}
          </div>
        </div>

        {!template.isActive && (
          <Card>
            <CardContent className="py-4">
              <PublishFlowSteps currentStep="preview" />
              <p className="mt-3 text-sm text-muted-foreground">
                Step 2 of 3: Review desktop and mobile previews with sample invoice data, then activate when ready.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Desktop Preview</p>
            <Card>
              <CardContent className="p-8">
                <DetailedInvoicePreview branding={branding} theme={template.theme} />
              </CardContent>
            </Card>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Mobile Preview</p>
            <MobilePreviewFrame>
              <DetailedInvoicePreview branding={branding} theme={template.theme} compact />
            </MobilePreviewFrame>
          </div>
        </div>

        <Dialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Activate Template</DialogTitle>
              <DialogDescription>
                Step 3 of 3: Publish &ldquo;{template.name}&rdquo; and make it available for new invoices?
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <PublishFlowSteps currentStep="activate" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActivateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleActivate}>Publish Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}

function DetailedInvoicePreview({
  branding,
  theme = "classic",
  compact = false,
}: {
  branding: TemplateBranding;
  theme?: "classic" | "modern" | "minimal";
  compact?: boolean;
}) {
  return (
    <div style={{ fontFamily: branding.fontFamily }} className={compact ? "text-xs" : "text-sm"}>
      <TemplatePreview branding={branding} theme={theme} compact={compact} />
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
