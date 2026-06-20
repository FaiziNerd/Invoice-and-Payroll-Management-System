"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  createClient,
  updateClient,
  deleteClient,
  restoreClient,
} from "@/lib/repositories/clients";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { useCompanyDataReady } from "@/hooks/use-storage-data";
import { TableSkeleton } from "@/components/shared/skeletons";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import type { Client } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 10;

type SortDir = "asc" | "desc";

export default function ClientsPage() {
  const { session } = useAuth();
  const companyReady = useCompanyDataReady();
  const [view, setView] = useState<"active" | "trash">("active");
  const {
    items: clients,
    loading: listLoading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
  } = usePaginatedList<Client>("/api/clients", { trash: view === "trash" });
  const isLoading = !companyReady || listLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const sorted = [...clients].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = () => {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", address: "" });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({ name: client.name, email: client.email, phone: client.phone, address: client.address });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validateForm = () => {
    const errors: { name?: string; email?: string } = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.email.trim()) {
      errors.email = "Email is required";
    } else if (!EMAIL_RE.test(form.email.trim())) {
      errors.email = "Enter a valid email address";
    }
    return errors;
  };

  const handleSave = async () => {
    if (!session) return;
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    try {
      if (editing) {
        await updateClient(editing.id, form);
        toast.success("Client updated");
      } else {
        await createClient(form);
        toast.success("Client created");
      }
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save client");
    }
  };

  const confirmDelete = async () => {
    if (!session || !deleteTarget) return;
    try {
      await deleteClient(deleteTarget.id);
      toast.success("Client moved to trash");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete client");
    }
  };

  const SortIcon = sortDir === "asc" ? ChevronUp : ChevronDown;

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <PageHeader title="Clients" description="Manage customer records">
          <div className="flex gap-2">
            <Button variant={view === "active" ? "default" : "outline"} onClick={() => setView("active")}>
              Active
            </Button>
            <Button variant={view === "trash" ? "default" : "outline"} onClick={() => setView("trash")}>
              Trash
            </Button>
            {view === "active" && (
              <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Client</Button>
            )}
          </div>
        </PageHeader>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : clients.length === 0 ? (
              <EmptyState
                icon="users"
                title="No clients yet"
                description="Add your first client to start creating invoices."
                action={
                  <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Client</Button>
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            onClick={toggleSort}
                            aria-label={`Sort by name ${sortDir === "asc" ? "descending" : "ascending"}`}
                          >
                            Name <SortIcon className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>{client.email}</TableCell>
                          <TableCell>{client.phone}</TableCell>
                          <TableCell>{client.address}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {view === "trash" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    await restoreClient(client.id);
                                    toast.success("Client restored");
                                    await refresh();
                                  }}
                                >
                                  Restore
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Edit ${client.name}`}
                                    onClick={() => openEdit(client)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete ${client.name}`}
                                    onClick={() => setDeleteTarget(client)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {paged.map((client) => (
                    <div key={client.id} className="rounded-lg border p-4">
                      <div className="flex justify-between">
                        <span className="font-medium">{client.name}</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${client.name}`}
                            onClick={() => openEdit(client)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${client.name}`}
                            onClick={() => setDeleteTarget(client)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                      <p className="text-sm">{client.phone}</p>
                    </div>
                  ))}
                </div>

                <DataTablePagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                      {loadingMore ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setFormErrors({}); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Name</Label>
                <Input
                  id="client-name"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                  }}
                  className={formErrors.name ? "border-destructive" : ""}
                />
                {formErrors.name && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />{formErrors.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                  }}
                  className={formErrors.email ? "border-destructive" : ""}
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />{formErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">Phone</Label>
                <Input
                  id="client-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-address">Address</Label>
                <Input
                  id="client-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Client</DialogTitle>
              <DialogDescription>
                Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}
