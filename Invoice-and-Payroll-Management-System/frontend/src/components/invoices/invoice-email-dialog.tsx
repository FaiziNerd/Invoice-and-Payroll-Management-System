"use client";

import { Send, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Client, Invoice } from "@/types";
import {
  buildInvoiceEmailPreview,
  getEmailDialogTitle,
  type EmailMode,
} from "@/lib/invoices/email";

interface InvoiceEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  client: Client;
  mode: EmailMode;
  onConfirm: () => void;
}

export function InvoiceEmailDialog({
  open,
  onOpenChange,
  invoice,
  client,
  mode,
  onConfirm,
}: InvoiceEmailDialogProps) {
  const preview = buildInvoiceEmailPreview(invoice, client, mode);
  const Icon = mode === "reminder" ? Bell : Send;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{getEmailDialogTitle(mode)}</DialogTitle>
          <DialogDescription>
            Review the message below. The client will receive a real email with a link to view the invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">To: </span>
            <span className="font-medium">{preview.to}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Subject: </span>
            <span className="font-medium">{preview.subject}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Share link: </span>
            <span className="break-all font-medium">{preview.shareUrl}</span>
          </div>
          <div className="border-t pt-3">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {preview.body}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            <Icon className="h-4 w-4" />
            {mode === "reminder" ? "Send Reminder" : mode === "resend" ? "Resend Email" : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
