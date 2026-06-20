"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  USER_ROLES,
} from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import type { User, UserRole } from "@/types";

interface UserForm {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

const emptyForm: UserForm = { name: "", email: "", role: "accountant", password: "" };

export default function UsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const refresh = async () => {
    setLoading(true);
    setUsers(await getUsers());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [session?.companyId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, role: user.role, password: "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!session || !form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    try {
      if (editing) {
        await updateUser(
          editing.id,
          {
            name: form.name,
            email: form.email,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          },
          session.userId,
          session.name
        );
        toast.success("User updated");
      } else {
        if (!form.password) {
          toast.error("Password is required for new users");
          return;
        }
        await createUser(form, session.userId, session.name);
        toast.success("User created");
      }
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user");
    }
  };

  const handleDelete = async () => {
    if (!session || !deleting) return;
    try {
      await deleteUser(deleting.id, session.userId, session.name);
      toast.success("User removed from company");
      setDeleteOpen(false);
      setDeleting(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  return (
    <RoleGate roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader title="Users" description="Manage platform users and roles">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </PageHeader>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading users...</p>
            ) : users.length === 0 ? (
              <EmptyState
                icon="users"
                title="No users yet"
                description="Add your first platform user to get started."
                action={<Button onClick={openCreate}>Add User</Button>}
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                          </TableCell>
                          <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setDeleting(user); setDeleteOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-lg border p-4">
                      <div className="flex justify-between">
                        <span className="font-medium">{user.name}</span>
                        <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="mt-2 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(user)}>Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => { setDeleting(user); setDeleteOpen(true); }}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
              <DialogDescription>
                {editing ? "Update user details and role." : "Create a new platform user."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{editing ? "New Password (optional)" : "Password"}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove User</DialogTitle>
              <DialogDescription>
                Remove {deleting?.name} from this company? Their account will remain but lose access here.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}
