"use client";

import { use, useState, useMemo } from "react";
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
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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
  updateInvoiceStatus,
  deleteInvoice,
} from "@/lib/mock-db/invoices";
import { getClientById } from "@/lib/mock-db/clients";
import { getTemplateById } from "@/lib/mock-db/templates";
import { downloadInvoicePDF } from "@/lib/pdf/invoice-pdf";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import { QRCodeSVG } from "qrcode.react";
import { getUserById } from "@/lib/mock-db/auth";
import { addAuditLog } from "@/lib/audit";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { session } = useAuth();
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const invoice = useMemo(() => getInvoiceById(id), [id, refreshKey]);
  const client = useMemo(() => (invoice ? getClientById(invoice.clientId) : undefined), [invoice]);
  const template = useMemo(() => (invoice ? getTemplateById(invoice.templateId) : undefined), [invoice]);

  const refresh = () => setRefreshKey((k) => k + 1);

  if (!invoice || !client) {
    return <p className="text-center py-20 text-muted-foreground">Invoice not found</p>;
  }

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/share/invoice/${invoice.shareToken}`
    : `/share/invoice/${invoice.shareToken}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDownloadPDF = async () => {
    await downloadInvoicePDF(invoice, client, template);
    toast.success("PDF downloaded");
  };

  const handleSendEmail = () => {
    if (!session) return;
    updateInvoiceStatus(invoice.id, "sent", session.userId, session.name);
    addAuditLog({
      action: "send",
      entity: "invoice",
      entityId: invoice.id,
      userId: session.userId,
      userName: session.name,
      description: `Sent invoice ${invoice.invoiceNumber} to ${client.email} (mock)`,
      metadata: { email: client.email },
    });
    setShowEmailDialog(false);
    toast.success(`Invoice sent to ${client.email}`);
    refresh();
  };

  const handleMarkPaid = () => {
    if (!session) return;
    updateInvoiceStatus(invoice.id, "paid", session.userId, session.name);
    toast.success("Invoice marked as paid");
    refresh();
  };

  const handleDelete = () => {
    if (!session) return;
    deleteInvoice(invoice.id, session.userId, session.name);
    toast.success("Invoice deleted");
    router.push("/invoices");
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <PageHeader title={invoice.invoiceNumber} description={`Invoice for ${client.name}`}>
          <div className="flex flex-wrap gap-2">
            {invoice.status !== "paid" && (
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
              <Button size="sm" onClick={() => setShowEmailDialog(true)}>
                <Send className="h-4 w-4" /> Send
              </Button>
            )}
            {(invoice.status === "sent" || invoice.status === "overdue") && (
              <Button size="sm" onClick={handleMarkPaid}>
                <CheckCircle className="h-4 w-4" /> Mark Paid
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Invoice Details</CardTitle>
                <InvoiceStatusBadge status={invoice.status} />
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
              </div>

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
              <div className="space-y-3">
                {invoice.history.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-primary pl-3">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.userName || (entry.userId ? getUserById(entry.userId)?.name : undefined) || "Unknown"} · {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Invoice</DialogTitle>
              <DialogDescription>
                Send invoice {invoice.invoiceNumber} to {client.email}?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
              <Button onClick={handleSendEmail}><Send className="h-4 w-4" /> Send Email</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Invoice</DialogTitle>
              <DialogDescription>Scan QR code or copy the link to share</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <QRCodeSVG value={shareUrl} size={200} />
              <p className="text-sm text-muted-foreground break-all text-center">{shareUrl}</p>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>Copy Link</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Invoice</DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}
