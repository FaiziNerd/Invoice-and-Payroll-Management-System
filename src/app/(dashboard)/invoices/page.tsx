"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInvoices } from "@/lib/mock-db/invoices";
import { getClients } from "@/lib/mock-db/clients";
import { useStorageData } from "@/hooks/use-storage-data";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const invoices = useStorageData(() => getInvoices(), ["invoices"]);
  const clients = useStorageData(() => getClients(), ["clients"]);

  const filtered = invoices.filter((inv) => {
    const client = clients.find((c) => c.id === inv.clientId);
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      client?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesClient = clientFilter === "all" || inv.clientId === clientFilter;
    const issueDate = new Date(inv.issueDate);
    const matchesFrom = !dateFrom || issueDate >= new Date(dateFrom);
    const matchesTo = !dateTo || issueDate <= new Date(`${dateTo}T23:59:59`);
    return matchesSearch && matchesStatus && matchesClient && matchesFrom && matchesTo;
  });

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <PageHeader title="Invoices" description="Manage and track all invoices">
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        </PageHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full sm:w-40"
            aria-label="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full sm:w-40"
            aria-label="To date"
          />
        </div>

        <Card>
          <CardContent className="pt-6">
            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No invoices found.</p>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((inv) => {
                        const client = clients.find((c) => c.id === inv.clientId);
                        return (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                                {inv.invoiceNumber}
                              </Link>
                            </TableCell>
                            <TableCell>{client?.name}</TableCell>
                            <TableCell>{formatCurrency(inv.total)}</TableCell>
                            <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                            <TableCell>{formatDate(inv.issueDate)}</TableCell>
                            <TableCell>{formatDate(inv.dueDate)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {filtered.map((inv) => {
                    const client = clients.find((c) => c.id === inv.clientId);
                    return (
                      <Link key={inv.id} href={`/invoices/${inv.id}`} className="block rounded-lg border p-4 hover:bg-accent">
                        <div className="flex justify-between">
                          <span className="font-medium">{inv.invoiceNumber}</span>
                          <InvoiceStatusBadge status={inv.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{client?.name}</p>
                        <p className="font-semibold">{formatCurrency(inv.total)}</p>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
