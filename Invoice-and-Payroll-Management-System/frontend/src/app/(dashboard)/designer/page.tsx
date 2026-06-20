"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Copy, Trash2, Star, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getTemplates,
  duplicateTemplate,
  deleteTemplate,
  updateTemplate,
} from "@/lib/repositories/templates";
import { useStorageDataWithLoading } from "@/hooks/use-storage-data";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";

export default function DesignerPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: templates, isLoading } = useStorageDataWithLoading(() => getTemplates(), ["templates"]);

  const handleDuplicate = async (id: string) => {
    if (!session) return;
    try {
      await duplicateTemplate(id, session.userId, session.name);
      toast.success("Template duplicated");
    } catch {
      toast.error("Failed to duplicate template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!session) return;
    try {
      await deleteTemplate(id, session.userId, session.name);
      toast.success("Template deleted");
    } catch {
      toast.error("Cannot delete the default template");
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!session) return;
    try {
      await updateTemplate(id, { isDefault: true }, session.userId, session.name);
      toast.success("Default template updated");
    } catch {
      toast.error("Failed to update default template");
    }
  };

  const handlePublish = (id: string) => {
    router.push(`/designer/preview/${id}`);
    toast.info("Review the preview, then activate the template");
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <PageHeader title="Invoice Designer" description="Create and manage invoice templates">
          <Button asChild>
            <Link href="/designer/new"><Plus className="h-4 w-4" /> New Template</Link>
          </Button>
        </PageHeader>

        {isLoading ? null : templates.length === 0 ? (
          <EmptyState
            icon="palette"
            title="No templates yet"
            description="Create your first invoice template to brand your invoices."
            action={<Button asChild><Link href="/designer/new">Create Template</Link></Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="overflow-hidden">
                <div className="h-3" style={{ backgroundColor: template.branding.primaryColor }} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="flex gap-1">
                      {template.isDefault && <Badge>Default</Badge>}
                      {!template.isActive && <Badge variant="secondary">Draft</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">{template.theme} theme</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border p-4 text-sm" style={{ fontFamily: template.branding.fontFamily }}>
                    <p className="font-bold" style={{ color: template.branding.primaryColor }}>
                      {template.branding.companyName}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">INVOICE PREVIEW</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/designer/${template.id}`}>Edit</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/designer/preview/${template.id}`}>
                        <Eye className="h-3 w-3" /> Preview
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(template.id)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    {!template.isDefault && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleSetDefault(template.id)}>
                          <Star className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(template.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {!template.isActive && (
                      <Button size="sm" onClick={() => handlePublish(template.id)}>Publish</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RoleGate>
  );
}
