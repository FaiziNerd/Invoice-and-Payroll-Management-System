"use client";

import { useState, useEffect } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSettings, updateSettings } from "@/lib/mock-db/settings";
import { getTemplates } from "@/lib/mock-db/templates";
import { useAuth } from "@/providers/auth-provider";
import { useStorageData } from "@/hooks/use-storage-data";
import { toast } from "sonner";

export default function SettingsPage() {
  const { session } = useAuth();
  const settings = useStorageData(() => getSettings(), ["settings"]);
  const templates = useStorageData(() => getTemplates(), ["templates"]);

  const [name, setName] = useState(settings.name);
  const [address, setAddress] = useState(settings.address);
  const [defaultTemplateId, setDefaultTemplateId] = useState(settings.defaultTemplateId || "none");

  useEffect(() => {
    setName(settings.name);
    setAddress(settings.address);
    setDefaultTemplateId(settings.defaultTemplateId || "none");
  }, [settings]);

  const handleSave = () => {
    if (!session) return;
    if (!name.trim()) {
      toast.error("Organization name is required");
      return;
    }
    updateSettings(
      {
        name: name.trim(),
        address: address.trim(),
        defaultTemplateId: defaultTemplateId === "none" ? "" : defaultTemplateId,
      },
      session.userId,
      session.name
    );
    toast.success("Organization settings saved");
  };

  return (
    <RoleGate roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader
          title="Organization Settings"
          description="Company details used on invoices and salary slip PDFs"
        />

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="DotCode Solutions"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-address">Address</Label>
              <Textarea
                id="org-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Business Ave, Suite 100, New York, NY 10001"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-template">Default Invoice Template</Label>
              <Select value={defaultTemplateId} onValueChange={setDefaultTemplateId}>
                <SelectTrigger id="default-template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              These details appear on generated invoice and salary slip PDFs.
            </p>
            <Button onClick={handleSave}>Save Settings</Button>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
