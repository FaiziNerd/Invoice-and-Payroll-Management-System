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
      <DialogContent className="flex w-[calc(100%-2rem)] max-w-lg flex-col gap-4 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{getEmailDialogTitle(mode)}</DialogTitle>
          <DialogDescription>
            Review the message below. The client will receive a real email with a link to view the invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 space-y-3 overflow-y-auto rounded-lg border bg-muted/40 p-4 text-sm">
          <div className="min-w-0">
            <span className="text-muted-foreground">To: </span>
            <span className="break-words font-medium">{preview.to}</span>
          </div>
          <div className="min-w-0">
            <span className="text-muted-foreground">Subject: </span>
            <span className="break-words font-medium">{preview.subject}</span>
          </div>
          <div className="min-w-0">
            <span className="text-muted-foreground">Share link: </span>
            <div className="mt-0.5 overflow-x-auto">
              <p className="break-all font-medium">{preview.shareUrl}</p>
            </div>
          </div>
          <div className="min-w-0 border-t pt-3">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
              {preview.body}
            </pre>
          </div>
        </div>

        <DialogFooter className="shrink-0">
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
