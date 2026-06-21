"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Send,
  QrCode,
  Trash2,
  CheckCircle,
  Clock,
  Pencil,
  Copy,
  Check,
  AlertTriangle,
  Bell,
  RotateCw,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getInvoiceById,
  fetchInvoiceById,
  deleteInvoice,
  sendInvoiceEmail,
} from "@/lib/repositories/invoices";
import { fetchInvoicePayments, voidInvoice } from "@/lib/repositories/payments";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { fetchClientById } from "@/lib/repositories/clients";
import { getTemplateById } from "@/lib/repositories/templates";
import { useTemplates } from "@/hooks/use-templates";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { InvoiceEmailDialog } from "@/components/invoices/invoice-email-dialog";
import type { EmailMode } from "@/lib/invoices/email";
import { copyTextToClipboard, formatCurrency, formatDate, getDaysOverdue } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import { QRCodeSVG } from "qrcode.react";
import type { Client, Payment } from "@/types";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { session } = useAuth();
  const [emailMode, setEmailMode] = useState<EmailMode | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [shareUrl, setShareUrl] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [invoice, setInvoice] = useState(() => getInvoiceById(id));
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(true);

  useTemplates();

  const template = invoice ? getTemplateById(invoice.templateId) : undefined;
  const [client, setClient] = useState<Client | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    setIsLoadingInvoice(true);
    void fetchInvoiceById(id)
      .then((next) => {
        if (mounted) setInvoice(next);
      })
      .finally(() => {
        if (mounted) setIsLoadingInvoice(false);
      });
    return () => {
      mounted = false;
    };
  }, [id, refreshKey]);

  useEffect(() => {
    if (!invoice) {
      setClient(undefined);
      return;
    }
    void fetchClientById(invoice.clientId).then(setClient);
  }, [invoice?.clientId]);

  useEffect(() => {
    if (!invoice) return;
    void fetchInvoicePayments(invoice.id).then(setPayments);
  }, [invoice?.id, refreshKey]);

  useEffect(() => {
    if (!showQrDialog) setLinkCopied(false);
  }, [showQrDialog]);

  const refresh = () => setRefreshKey((k) => k + 1);

  if (isLoadingInvoice) {
    return (
      <RoleGate roles={["admin", "accountant"]}>
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading invoice...
        </div>
      </RoleGate>
    );
  }

  if (!invoice || !client) {
    return (
      <RoleGate roles={["admin", "accountant"]}>
        <EmptyState
          icon="file"
          title="Invoice not found"
          description="This invoice may have been deleted or the link is invalid."
          action={
            <Button asChild>
              <Link href="/invoices">Back to Invoices</Link>
            </Button>
          }
        />
      </RoleGate>
    );
  }

  const daysOverdue = invoice.status === "overdue" ? getDaysOverdue(invoice.dueDate) : 0;

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    const copied = await copyTextToClipboard(shareUrl);
    if (copied) {
      setLinkCopied(true);
      toast.success("Link copied to clipboard");
    } else {
      toast.error("Failed to copy link");
    }
  };

  const handleDownloadPDF = async () => {
    const { downloadInvoicePDF } = await import("@/lib/pdf/invoice-pdf");
    await downloadInvoicePDF(invoice, client, template);
    toast.success("PDF downloaded");
  };

  const handleEmailConfirm = async () => {
    if (!session || !emailMode) return;
    try {
      await sendInvoiceEmail(invoice.id, session.userId, session.name, client.email, emailMode);
      setEmailMode(null);

      const messages: Record<EmailMode, string> = {
        send: `Invoice sent to ${client.email}`,
        resend: `Invoice resent to ${client.email}`,
        reminder: `Payment reminder sent to ${client.email}`,
      };
      toast.success(messages[emailMode]);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    }
  };

  const handleVoid = async () => {
    if (!session || !voidReason.trim()) return;
    try {
      await voidInvoice(invoice.id, voidReason.trim());
      toast.success("Invoice voided");
      setShowVoidDialog(false);
      setVoidReason("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void invoice");
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    try {
      await deleteInvoice(invoice.id, session.userId, session.name);
      toast.success("Invoice deleted");
      router.push("/invoices");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
    }
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Invoices", href: "/invoices" },
            { label: invoice.invoiceNumber },
          ]}
        />
        <PageHeader title={invoice.invoiceNumber} description={`Invoice for ${client.name}`}>
          <div className="flex flex-wrap gap-2">
            {invoice.status === "draft" && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/invoices/${invoice.id}/edit`}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowQrDialog(true)}>
              <QrCode className="h-4 w-4" /> QR
            </Button>
            {invoice.status === "draft" && (
              <Button size="sm" onClick={() => setEmailMode("send")}>
                <Send className="h-4 w-4" /> Send
              </Button>
            )}
            {(invoice.status === "sent" ||
              invoice.status === "overdue" ||
              invoice.status === "partially_paid") && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEmailMode("resend")}>
                  <RotateCw className="h-4 w-4" /> Resend
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEmailMode("reminder")}>
                  <Bell className="h-4 w-4" /> Send Reminder
                </Button>
                <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
                  <CheckCircle className="h-4 w-4" /> Record Payment
                </Button>
              </>
            )}
            {invoice.status === "draft" && (
              <Button variant="destructive" size="sm" aria-label="Delete invoice" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {invoice.status !== "draft" && invoice.status !== "void" && (
              <Button variant="destructive" size="sm" onClick={() => setShowVoidDialog(true)}>
                Void Invoice
              </Button>
            )}
          </div>
        </PageHeader>

        {invoice.paymentVariance === "overpayment" && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="inline h-4 w-4 mr-2" />
            Overpayment recorded: {formatCurrency(invoice.amountPaid)} received against{" "}
            {formatCurrency(invoice.total)} total. Review before closing books.
          </div>
        )}

        {invoice.status === "void" && invoice.voidReason && (
          <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
            Void reason: {invoice.voidReason}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Invoice Details</CardTitle>
                <div className="flex items-center gap-2">
                  {invoice.status === "overdue" && daysOverdue > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue
                    </span>
                  )}
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm">{client.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dates</p>
                  <p className="text-sm">Issued: {formatDate(invoice.issueDate)}</p>
                  <p className="text-sm">Due: {formatDate(invoice.dueDate)}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col items-end gap-1 text-sm">
                <div className="flex gap-8"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
                <div className="flex gap-8"><span>Tax ({invoice.taxRate}%)</span><span>{formatCurrency(invoice.taxAmount)}</span></div>
                <div className="flex gap-8 font-bold text-lg"><span>Total</span><span>{formatCurrency(invoice.total)}</span></div>
                {invoice.amountPaid > 0 && (
                  <>
                    <div className="flex gap-8 text-green-700 dark:text-green-400">
                      <span>Paid</span><span>{formatCurrency(invoice.amountPaid)}</span>
                    </div>
                    <div className="flex gap-8 font-medium">
                      <span>Balance</span>
                      <span>{formatCurrency(Math.max(0, invoice.total - invoice.amountPaid))}</span>
                    </div>
                  </>
                )}
              </div>

              {payments.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <p className="text-sm font-medium">Payment Records</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatDate(p.paymentDate)}</TableCell>
                          <TableCell className="capitalize">{p.method.replace("_", " ")}</TableCell>
                          <TableCell>{p.referenceNumber || "—"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {invoice.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p>{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No history yet.</p>
              ) : (
                <div className="space-y-3">
                  {invoice.history.map((entry) => {
                    const isOverdueEntry = entry.action.toLowerCase().includes("overdue");
                    const isReminderEntry = entry.action.toLowerCase().includes("reminder");
                    const actor = entry.userName || "Unknown";

                    return (
                      <div
                        key={entry.id}
                        className={`border-l-2 pl-3 ${
                          isOverdueEntry
                            ? "border-destructive"
                            : isReminderEntry
                              ? "border-amber-500"
                              : "border-primary"
                        }`}
                      >
                        <p className={`text-sm font-medium ${isOverdueEntry ? "text-destructive" : ""}`}>
                          {entry.action}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {actor} · {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {emailMode && (
          <InvoiceEmailDialog
            open={!!emailMode}
            onOpenChange={(open) => !open && setEmailMode(null)}
            invoice={invoice}
            client={client}
            mode={emailMode}
            onConfirm={handleEmailConfirm}
          />
        )}

        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Invoice</DialogTitle>
              <DialogDescription>Scan QR code or copy the link to share</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <QRCodeSVG value={shareUrl || `/share/invoice/${invoice.shareToken}`} size={200} />
              <div className="flex w-full gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="text-sm"
                  aria-label="Share link"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  disabled={!shareUrl}
                  aria-label={linkCopied ? "Link copied" : "Copy link"}
                >
                  {linkCopied ? <Check className="h-4 w-4 text-green-600 dark:text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Invoice</DialogTitle>
              <DialogDescription>Draft invoices only. This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void Invoice</DialogTitle>
              <DialogDescription>
                Issued invoices cannot be deleted. Voiding preserves the invoice number for audit purposes.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Reason for voiding (required)"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVoidDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleVoid} disabled={voidReason.trim().length < 3}>
                Void Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <RecordPaymentDialog
          invoice={invoice}
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          onRecorded={() => {
            toast.success("Payment recorded");
            refresh();
          }}
        />
      </div>
    </RoleGate>
  );
}
