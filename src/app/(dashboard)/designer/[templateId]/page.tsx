"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTemplateById,
  createTemplate,
  updateTemplate,
} from "@/lib/mock-db/templates";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import { TemplatePreview } from "@/components/designer/template-preview";
import { PublishFlowSteps } from "@/components/designer/publish-flow-steps";
import { MobilePreviewFrame } from "@/components/designer/mobile-preview-frame";
import type { TemplateBranding } from "@/types";

const defaultBranding: TemplateBranding = {
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  fontFamily: "Inter",
  sections: { logo: true, notes: true, paymentTerms: true, footer: true },
  companyName: "DotCode Solutions",
  companyAddress: "123 Business Ave, Suite 100, New York, NY 10001",
  paymentTerms: "Payment due within 30 days.",
  footerText: "Thank you for your business!",
};

export default function TemplateEditorPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);
  const isNew = templateId === "new";
  const router = useRouter();
  const { session } = useAuth();

  const existing = !isNew ? getTemplateById(templateId) : null;

  const [name, setName] = useState(existing?.name || "New Template");
  const [theme, setTheme] = useState<"classic" | "modern" | "minimal">(existing?.theme || "modern");
  const [branding, setBranding] = useState<TemplateBranding>(existing?.branding || defaultBranding);
  const [isActive, setIsActive] = useState(existing?.isActive ?? false);

  if (!isNew && !existing) {
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBranding({ ...branding, logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const persistTemplate = (redirectToPreview = false) => {
    if (!session) return null;

    if (isNew) {
      const created = createTemplate(
        { name, isDefault: false, isActive: false, theme, branding },
        session.userId,
        session.name
      );
      toast.success("Template saved as draft");
      if (redirectToPreview) {
        router.push(`/designer/preview/${created.id}`);
      } else {
        router.push(`/designer/${created.id}`);
      }
      return created;
    }

    if (existing) {
      const updated = updateTemplate(existing.id, { name, theme, branding }, session.userId, session.name);
      if (updated) {
        setIsActive(updated.isActive);
        toast.success("Template saved");
        if (redirectToPreview) {
          router.push(`/designer/preview/${existing.id}`);
        }
      }
      return updated;
    }

    return null;
  };

  const handleSave = () => {
    persistTemplate(false);
  };

  const handleSaveAndPreview = () => {
    persistTemplate(true);
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <PageHeader title={isNew ? "New Template" : `Edit: ${name}`}>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push("/designer")}>Back</Button>
            <Button variant="outline" onClick={handleSave}>Save Draft</Button>
            {!isNew && (
              <Button onClick={handleSaveAndPreview}>Save & Preview</Button>
            )}
            {isNew && (
              <Button onClick={handleSave}>Save Template</Button>
            )}
          </div>
        </PageHeader>

        {!isActive && (
          <Card>
            <CardContent className="py-4">
              <PublishFlowSteps currentStep="design" />
              <p className="mt-3 text-sm text-muted-foreground">
                Step 1 of 3: Customize your template, then preview and activate it for use on invoices.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>General</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <Input type="color" value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <Input type="color" value={branding.secondaryColor} onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select value={branding.fontFamily} onValueChange={(v) => setBranding({ ...branding, fontFamily: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={branding.companyName} onChange={(e) => setBranding({ ...branding, companyName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Company Address</Label>
                  <Textarea value={branding.companyAddress} onChange={(e) => setBranding({ ...branding, companyAddress: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Sections</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(["logo", "notes", "paymentTerms", "footer"] as const).map((section) => (
                  <div key={section} className="flex items-center justify-between">
                    <Label className="capitalize">{section === "paymentTerms" ? "Payment Terms" : section}</Label>
                    <Switch
                      checked={branding.sections[section]}
                      onCheckedChange={(checked) =>
                        setBranding({
                          ...branding,
                          sections: { ...branding.sections, [section]: checked },
                        })
                      }
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Payment Terms Text</Label>
                  <Textarea value={branding.paymentTerms} onChange={(e) => setBranding({ ...branding, paymentTerms: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Footer Text</Label>
                  <Input value={branding.footerText} onChange={(e) => setBranding({ ...branding, footerText: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 sticky top-6 h-fit">
            <Card>
              <CardHeader><CardTitle>Live Preview</CardTitle></CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Desktop</p>
                  <div className="rounded-lg border p-4">
                    <TemplatePreview branding={branding} theme={theme} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Mobile</p>
                  <MobilePreviewFrame>
                    <TemplatePreview branding={branding} theme={theme} compact />
                  </MobilePreviewFrame>
                </div>
              </CardContent>
            </Card>
            {!isNew && !isActive && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/designer/preview/${templateId}`)}
              >
                Continue to Preview
              </Button>
            )}
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
