"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
import { useStorageData, useStorageDataWithLoading } from "@/hooks/use-storage-data";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/skeletons";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";

type SortField = "amount" | "dueDate" | "status" | null;
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

const STATUS_ORDER = ["draft", "sent", "overdue", "paid"];

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const { data: invoices, isLoading } = useStorageDataWithLoading(() => getInvoices(), ["invoices"]);
  const clients = useStorageData(() => getClients(), ["clients"]);

  const isFiltered =
    search !== "" ||
    statusFilter !== "all" ||
    clientFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setClientFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    let cmp = 0;
    if (sortField === "amount") cmp = a.total - b.total;
    else if (sortField === "dueDate") cmp = a.dueDate.localeCompare(b.dueDate);
    else if (sortField === "status") {
      cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

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
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setPage(1); }}>
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
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-full sm:w-40"
            aria-label="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-full sm:w-40"
            aria-label="To date"
          />
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
              <X className="h-4 w-4" /> Clear filters
            </Button>
          )}
        </div>

        {invoices.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {invoices.length} results
          </p>
        )}

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : invoices.length === 0 ? (
              <EmptyState
                icon="file"
                title="No invoices yet"
                description="Create your first invoice to start tracking billing."
                action={
                  <Button asChild>
                    <Link href="/invoices/new">
                      <Plus className="h-4 w-4" />
                      New Invoice
                    </Link>
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="file"
                title="No matching invoices"
                description="Try adjusting your search or filter criteria."
                action={
                  isFiltered ? (
                    <Button variant="outline" onClick={clearFilters}>
                      <X className="h-4 w-4" /> Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>
                          <button
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            onClick={() => handleSort("amount")}
                            aria-label={`Sort by amount ${sortField === "amount" && sortDir === "asc" ? "descending" : "ascending"}`}
                          >
                            Amount <SortIcon field="amount" />
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            onClick={() => handleSort("status")}
                            aria-label={`Sort by status`}
                          >
                            Status <SortIcon field="status" />
                          </button>
                        </TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>
                          <button
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            onClick={() => handleSort("dueDate")}
                            aria-label={`Sort by due date ${sortField === "dueDate" && sortDir === "asc" ? "descending" : "ascending"}`}
                          >
                            Due Date <SortIcon field="dueDate" />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((inv) => {
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
                  {paged.map((inv) => {
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
                <DataTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
